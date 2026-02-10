import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SyncDataFoldersPublicProgress } from '@/app/components/jobs/SyncStatus/SyncJobProgress';
import { jobApi } from '@/lib/api/job';
import { syncApi } from '@/lib/api/sync';
import { trackRunSync } from '@/lib/posthog';
import { JobEntity } from '@/types/server-entities/job';
import { Sync, SyncId, WorkbookId } from '@spinner/shared-types';
import { create } from 'zustand';

interface SyncStoreState {
  syncs: Sync[];
  activeJobs: Record<SyncId, string>; // Maps SyncId to JobId
  jobStatuses: Record<string, JobEntity>; // Maps JobId to JobEntity
  isPolling: boolean;
  isLoading: boolean;
  workbookId: WorkbookId | null;

  // Actions
  fetchSyncs: (workbookId: WorkbookId) => Promise<void>;
  runSync: (workbookId: WorkbookId, syncId: SyncId) => Promise<void>;
  // Internal use but exposed for manual trigger if needed
  startPolling: () => void;
}

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  syncs: [],
  activeJobs: {},
  jobStatuses: {},
  isPolling: false,
  isLoading: false,
  workbookId: null, // Initial state for workbookId

  fetchSyncs: async (workbookId: WorkbookId) => {
    try {
      set({ workbookId, isLoading: true }); // Verify we have it
      const syncs = await syncApi.list(workbookId);
      set({ syncs, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch syncs:', error);
      set({ isLoading: false });
    }
  },

  runSync: async (workbookId: WorkbookId, syncId: SyncId) => {
    try {
      set({ workbookId }); // Ensure it's set
      trackRunSync(syncId, workbookId);
      const { jobId } = await syncApi.run(workbookId, syncId);

      set((state) => ({
        activeJobs: { ...state.activeJobs, [syncId]: jobId },
        // Set initial optimistic status
        jobStatuses: {
          ...state.jobStatuses,
          [jobId]: {
            state: 'active',
            type: 'sync',
            dbJobId: jobId,
          } as JobEntity,
        },
      }));

      get().startPolling();
    } catch (error) {
      console.error('Failed to run sync:', error);
      throw error;
    }
  },

  startPolling: () => {
    if (get().isPolling) return;
    set({ isPolling: true });

    const poll = async () => {
      const state = get();
      const jobIds = Object.values(state.activeJobs);

      if (jobIds.length === 0) {
        set({ isPolling: false });
        return;
      }

      const updates: Record<string, JobEntity> = {};
      const finishedSyncIds: SyncId[] = [];
      let shouldRefreshSyncs = false;

      // Bulk fetch statuses
      try {
        const jobs = await jobApi.getJobsStatus(jobIds);

        for (const job of jobs) {
          if (!job.dbJobId) continue;
          updates[job.dbJobId] = job;

          if (job.state === 'completed' || job.state === 'failed' || job.state === 'canceled') {
            const syncId = Object.keys(state.activeJobs).find(
              (key) => state.activeJobs[key as SyncId] === job.dbJobId,
            ) as SyncId;

            if (syncId) {
              finishedSyncIds.push(syncId);
              if (job.state === 'completed') {
                shouldRefreshSyncs = true;
                // Show success notification with counts
                const progress = job.publicProgress as SyncDataFoldersPublicProgress | undefined;
                if (progress?.tables) {
                  const failedTables = progress.tables.filter((t) => t.status === 'failed');
                  const succeededTables = progress.tables.filter((t) => t.status !== 'failed');
                  const totals = succeededTables.reduce(
                    (acc, table) => ({
                      creates: acc.creates + table.creates,
                      updates: acc.updates + table.updates,
                      deletes: acc.deletes + table.deletes,
                    }),
                    { creates: 0, updates: 0, deletes: 0 },
                  );
                  const parts: string[] = [];
                  if (totals.creates > 0) parts.push(`${totals.creates} created`);
                  if (totals.updates > 0) parts.push(`${totals.updates} updated`);
                  if (totals.deletes > 0) parts.push(`${totals.deletes} deleted`);
                  if (failedTables.length > 0) {
                    parts.push(`${failedTables.length} table${failedTables.length > 1 ? 's' : ''} failed`);
                  }
                  const message = parts.length > 0 ? parts.join(', ') : 'No changes';
                  if (failedTables.length > 0) {
                    ScratchpadNotifications.warning({ title: 'Sync completed with errors', message });
                  } else {
                    ScratchpadNotifications.success({ title: 'Sync completed', message });
                  }
                } else {
                  ScratchpadNotifications.success({ title: 'Sync completed', message: 'Sync finished successfully' });
                }
              } else if (job.state === 'failed') {
                ScratchpadNotifications.error({
                  title: 'Sync failed',
                  message: job.failedReason || 'Unknown error',
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to poll jobs:', error);
      }

      set((prev) => {
        const nextActiveJobs = { ...prev.activeJobs };
        for (const syncId of finishedSyncIds) {
          delete nextActiveJobs[syncId];
        }
        return {
          jobStatuses: { ...prev.jobStatuses, ...updates },
          activeJobs: nextActiveJobs,
        };
      });

      // If any sync completed, we might want to refresh the list to show updated "Last run"
      // However, we need workbookId.
      // We can rely on the UI to re-fetch if it observes a completion, or store workbookId in store.
      // For now, let's keep it simple.

      if (shouldRefreshSyncs && state.workbookId) {
        get().fetchSyncs(state.workbookId);
      }

      if (Object.keys(get().activeJobs).length > 0) {
        setTimeout(poll, 1000);
      } else {
        set({ isPolling: false });
      }
    };

    poll();
  },
}));
