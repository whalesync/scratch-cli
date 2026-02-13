import { DataFolder, DataFolderId, WorkbookId } from '@spinner/shared-types';
import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { jobApi } from '../lib/api/job';
import { SWR_KEYS } from '../lib/api/keys';
import { JobEntity } from '../types/server-entities/job';

/**
 * Returns the data folder IDs referenced in a job's publicProgress.
 *
 * - pull-linked-folder-files: single folderId
 * - publish-data-folder / sync-data-folders: tables[].id
 */
function getDataFolderIdsFromJob(job: JobEntity): string[] {
  const progress = job.publicProgress as Record<string, unknown> | undefined;
  if (!progress) return [];

  // Pull jobs store a single folderId
  if (typeof progress.folderId === 'string') {
    return [progress.folderId];
  }

  // Publish and sync jobs store tables with id fields
  if (Array.isArray(progress.tables)) {
    return (progress.tables as { id?: string }[]).map((t) => t.id).filter((id): id is string => !!id);
  }

  return [];
}

export function useWorkbookActiveJobs(workbookId: WorkbookId | undefined) {
  const { data, error, isLoading, mutate } = useSWR<JobEntity[]>(
    workbookId ? SWR_KEYS.jobs.activeByWorkbook(workbookId) : null,
    () => jobApi.getActiveJobsByWorkbook(workbookId!),
    {
      // TODO: eventually replace this agressive refresh with a mutate via the workbook websocket
      refreshInterval: 5000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const activeJobs = useMemo(() => data ?? [], [data]);

  const getJobsForDataFolder = useCallback(
    (dataFolderId: DataFolderId): JobEntity[] => {
      return activeJobs.filter((job) => {
        const folderIds = getDataFolderIdsFromJob(job);
        return folderIds.includes(dataFolderId);
      });
    },
    [activeJobs],
  );

  const getJobsForConnector = useCallback(
    (connectorAccountId: string, dataFolders: DataFolder[]): JobEntity[] => {
      const folderIdsForConnector = new Set(
        dataFolders.filter((f) => f.connectorAccountId === connectorAccountId).map((f) => f.id),
      );
      return activeJobs.filter((job) => {
        const jobFolderIds = getDataFolderIdsFromJob(job);
        return jobFolderIds.some((id) => folderIdsForConnector.has(id as DataFolderId));
      });
    },
    [activeJobs],
  );

  const refreshJobs = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return useMemo(
    () => ({
      activeJobs,
      error,
      isLoading,
      refreshJobs,
      getJobsForDataFolder,
      getJobsForConnector,
    }),
    [activeJobs, error, isLoading, refreshJobs, getJobsForDataFolder, getJobsForConnector],
  );
}
