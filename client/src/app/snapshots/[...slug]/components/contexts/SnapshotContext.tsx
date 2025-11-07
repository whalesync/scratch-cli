'use client';

import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useSnapshot } from '@/hooks/use-snapshot';
import { SWR_KEYS } from '@/lib/api/keys';
import { snapshotApi } from '@/lib/api/snapshot';
import { Snapshot, SnapshotColumnSettingsMap, UpdateSnapshotDto } from '@/types/server-entities/snapshot';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { useSWRConfig } from 'swr';

interface SnapshotContextValue {
  snapshot: Snapshot | undefined;
  isLoading: boolean;
  error: Error | undefined;
  refreshSnapshot: (() => Promise<void>) | undefined;
  publish: (() => Promise<void>) | undefined;
  // Filter management
  // filteredRecordsCount: number;
  clearActiveRecordFilter: (tableId: string) => Promise<void>;
  updateSnapshot: (updateDto: UpdateSnapshotDto) => Promise<void>;
  updateColumnSettings: (tableId: string, columnSettings: SnapshotColumnSettingsMap) => Promise<void>;
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
  const [viewDataAsAgent, setViewDataAsAgent] = useState(false);
  const { mutate } = useSWRConfig();

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
      mutate(SWR_KEYS.snapshot.list());
      mutate(SWR_KEYS.snapshot.detail(snapshot.id));
    },
    [snapshot, mutate],
  );
  const updateColumnSettings = useCallback(
    async (tableId: string, columnSettings: SnapshotColumnSettingsMap): Promise<void> => {
      if (!snapshot) return;
      await snapshotApi.updateColumnSettings(snapshot.id, tableId, { columnSettings });
      mutate(SWR_KEYS.snapshot.detail(snapshot.id));
    },
    [snapshot, mutate],
  );

  const value: SnapshotContextValue = {
    snapshot,
    isLoading: snapshotLoading,
    error: snapshotError,
    refreshSnapshot,
    publish,
    updateSnapshot,
    updateColumnSettings,
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
