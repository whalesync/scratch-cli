'use client';

import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useSnapshot } from '@/hooks/use-snapshot';
import { useUpsertView, useViews } from '@/hooks/use-view';
import { SWR_KEYS } from '@/lib/api/keys';
import { snapshotApi } from '@/lib/api/snapshot';
import { Snapshot, SnapshotColumnSettings, UpdateSnapshotDto } from '@/types/server-entities/snapshot';
import { ColumnView, ViewConfig } from '@/types/server-entities/view';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { useSWRConfig } from 'swr';

interface SnapshotContextValue {
  snapshot: Snapshot | undefined;
  views: ColumnView[] | undefined;
  currentViewId: string | null;
  currentView: ColumnView | undefined;
  isLoading: boolean;
  error: Error | undefined;
  refreshViews: (() => Promise<ColumnView[] | undefined>) | undefined;
  refreshSnapshot: (() => Promise<void>) | undefined;
  publish: (() => Promise<void>) | undefined;
  setCurrentViewId: (viewId: string | null) => void;
  createView: (config: ViewConfig, name?: string) => Promise<string>;
  selectView: (viewId: string | null) => void;
  updateTableInCurrentView: (tableId: string, tableConfig: Record<string, unknown>) => Promise<void>;
  // Filter management
  // filteredRecordsCount: number;
  clearActiveRecordFilter: (tableId: string) => Promise<void>;
  updateSnapshot: (updateDto: UpdateSnapshotDto) => Promise<void>;
  updateColumnContexts: (tableId: string, columnContexts: Record<string, SnapshotColumnSettings>) => Promise<void>;
  viewDataAsAgent: boolean;
  setViewDataAsAgent: (viewDataAsAgent: boolean) => void;
}

const SnapshotContext = createContext<SnapshotContextValue | undefined>(undefined);

interface SnapshotProviderProps {
  snapshotId: string;
  children: ReactNode;
}

export const SnapshotProvider = ({ snapshotId, children }: SnapshotProviderProps) => {
  const {
    snapshot,
    isLoading: snapshotLoading,
    error: snapshotError,
    publish,
    refreshSnapshot,
  } = useSnapshot(snapshotId);
  const { views, isLoading: viewsLoading, error: viewsError, refreshViews } = useViews(snapshotId);
  const { upsertView } = useUpsertView();
  const [currentViewId, setCurrentViewId] = useState<string | null>(null);
  const [viewDataAsAgent, setViewDataAsAgent] = useState(false);
  const { mutate } = useSWRConfig();

  // Get the current view based on currentViewId
  const currentView = views?.find((v) => v.id === currentViewId);

  const createView = useCallback(
    async (config: ViewConfig, name?: string): Promise<string> => {
      if (!snapshot) {
        throw new Error('Snapshot not available');
      }

      const result = await upsertView({
        snapshotId: snapshot.id,
        config,
        name,
      });

      // Refresh views after creation
      await refreshViews?.();

      return result.id;
    },
    [snapshot, upsertView, refreshViews],
  );

  const selectView = useCallback((viewId: string | null) => {
    setCurrentViewId(viewId);
  }, []);

  const updateTableInCurrentView = useCallback(
    async (tableId: string, tableConfig: Record<string, unknown>): Promise<void> => {
      if (!snapshot || !currentView) {
        throw new Error('Snapshot or current view not available');
      }

      const newConfig = {
        ...currentView.config,
        [tableId]: tableConfig,
      };

      await upsertView({
        id: currentView.id,
        name: currentView.name || undefined,
        snapshotId: snapshot.id,
        config: newConfig,
      });

      // Refresh views after update
      await refreshViews?.();
    },
    [snapshot, currentView, upsertView, refreshViews],
  );

  const clearActiveRecordFilter = useCallback(
    async (tableId: string) => {
      if (!snapshot) return;

      try {
        await snapshotApi.clearActiveRecordFilter(snapshot.id, tableId);
        ScratchpadNotifications.success({
          title: 'Filter Cleared',
          message: 'All records are now visible',
        });

        // Invalidate records cache to refresh the data
        mutate(
          (key) => Array.isArray(key) && key[0] === 'snapshot' && key[1] === 'records' && key[2] === snapshot.id,
          undefined,
          {
            revalidate: true,
          },
        );
      } catch (e) {
        const error = e as Error;
        ScratchpadNotifications.error({
          title: 'Error clearing filter',
          message: error.message,
          autoClose: 5000,
        });
      }
    },
    [snapshot, mutate],
  );

  const updateSnapshot = useCallback(
    async (updateDto: UpdateSnapshotDto): Promise<void> => {
      if (!snapshot) return;
      await snapshotApi.update(snapshot.id, updateDto);
      mutate(SWR_KEYS.snapshot.list('all'));
      mutate(SWR_KEYS.snapshot.detail(snapshot.id));
    },
    [snapshot, mutate],
  );
  const updateColumnContexts = useCallback(
    async (tableId: string, columnContexts: Record<string, SnapshotColumnSettings>): Promise<void> => {
      if (!snapshot) return;
      await snapshotApi.updateColumnContexts(snapshot.id, tableId, { columnContexts });
      mutate(SWR_KEYS.snapshot.detail(snapshot.id));
    },
    [snapshot, mutate],
  );

  const value: SnapshotContextValue = {
    snapshot,
    views,
    currentViewId,
    currentView,
    isLoading: snapshotLoading || viewsLoading,
    error: snapshotError || viewsError,
    refreshViews,
    refreshSnapshot,
    publish,
    updateSnapshot,
    updateColumnContexts,
    setCurrentViewId,
    createView,
    selectView,
    updateTableInCurrentView,
    // Filter management
    clearActiveRecordFilter,
    viewDataAsAgent,
    setViewDataAsAgent,
  };

  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>;
};

export const useSnapshotContext = () => {
  const context = useContext(SnapshotContext);
  if (context === undefined) {
    throw new Error('useSnapshotContext must be used within a SnapshotProvider');
  }
  return context;
};
