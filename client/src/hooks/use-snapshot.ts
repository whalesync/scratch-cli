import { isUnauthorizedError } from '@/lib/api/error';
import { SWR_KEYS } from '@/lib/api/keys';
import { snapshotApi } from '@/lib/api/snapshot';
import { Snapshot, SnapshotColumnSettingsMap, UpdateSnapshotDto } from '@/types/server-entities/snapshot';
import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ScratchpadNotifications } from '../app/components/ScratchpadNotifications';

export interface UseSnapshotReturn {
  snapshot: Snapshot | undefined;
  isLoading: boolean;
  error: Error | undefined;
  publish: () => Promise<void>;
  refreshSnapshot: () => Promise<void>;
  updateSnapshot: (updateDto: UpdateSnapshotDto) => Promise<void>;
  updateColumnSettings: (tableId: string, columnSettings: SnapshotColumnSettingsMap) => Promise<void>;
  clearActiveRecordFilter: (tableId: string) => Promise<void>;
  hideTable: (tableId: string) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;
  hideColumn: (tableId: string, columnId: string) => Promise<void>;
  unhideColumn: (tableId: string, columnId: string) => Promise<void>;
  showAllColumns: (tableId: string) => Promise<void>;
}

export const useSnapshot = (id: string | null): UseSnapshotReturn => {
  const { data, error, isLoading, mutate } = useSWR(
    id ? SWR_KEYS.snapshot.detail(id) : null,
    () => (id ? snapshotApi.detail(id) : undefined),
    {
      revalidateOnFocus: false,
    },
  );

  const { mutate: globalMutate } = useSWRConfig();

  const refreshSnapshot = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const publish = useCallback(async () => {
    if (!data || !id) {
      return;
    }

    await snapshotApi.publish(id);
    // Revalidate the snapshot itself
    await mutate();

    // Revalidate the records in all tables for this snapshot.
    globalMutate(
      (key) => Array.isArray(key) && key[0] === 'snapshot' && key[1] === 'records' && key[2] === id,
      undefined,
      { revalidate: true },
    );
  }, [id, data, mutate, globalMutate]);

  const displayError = useMemo(() => {
    if (isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  const updateSnapshot = useCallback(
    async (updateDto: UpdateSnapshotDto): Promise<void> => {
      if (!id) {
        return;
      }
      await snapshotApi.update(id, updateDto);
      globalMutate(SWR_KEYS.snapshot.list());
      globalMutate(SWR_KEYS.snapshot.detail(id));
    },
    [globalMutate, id],
  );

  const updateColumnSettings = useCallback(
    async (tableId: string, columnSettings: SnapshotColumnSettingsMap): Promise<void> => {
      if (!id) {
        return;
      }
      await snapshotApi.updateColumnSettings(id, tableId, { columnSettings });
      globalMutate(SWR_KEYS.snapshot.detail(id));
    },
    [globalMutate, id],
  );

  const clearActiveRecordFilter = useCallback(
    async (tableId: string) => {
      if (!id) {
        return;
      }

      try {
        await snapshotApi.clearActiveRecordFilter(id, tableId);
        ScratchpadNotifications.success({
          title: 'Filter Cleared',
          message: 'All records are now visible',
        });

        // Invalidate records cache to refresh the data
        globalMutate(
          (key) => Array.isArray(key) && key[0] === 'snapshot' && key[1] === 'records' && key[2] === id,
          undefined,
          { revalidate: true },
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
    [id, globalMutate],
  );

  const hideTable = useCallback(
    async (tableId: string) => {
      if (!id) {
        return;
      }
      await snapshotApi.hideTable(id, tableId, true);
      await mutate();
    },
    [id, mutate],
  );

  const deleteTable = useCallback(
    async (tableId: string) => {
      if (!id) {
        return;
      }
      await snapshotApi.deleteTable(id, tableId);
      await mutate();
    },
    [id, mutate],
  );

  const hideColumn = useCallback(
    async (tableId: string, columnId: string) => {
      if (!id) {
        return;
      }
      await snapshotApi.hideColumn(id, tableId, columnId);
      await mutate();
    },
    [id, mutate],
  );

  const unhideColumn = useCallback(
    async (tableId: string, columnId: string) => {
      if (!id) {
        return;
      }
      await snapshotApi.unhideColumn(id, tableId, columnId);
      await mutate();
    },
    [id, mutate],
  );

  const showAllColumns = useCallback(
    async (tableId: string) => {
      if (!id) {
        return;
      }
      await snapshotApi.clearHiddenColumns(id, tableId);
      await mutate();
    },
    [id, mutate],
  );

  return {
    snapshot: data,
    isLoading,
    error: displayError,
    publish,
    refreshSnapshot,
    updateSnapshot,
    updateColumnSettings,
    clearActiveRecordFilter,
    hideTable,
    deleteTable,
    hideColumn,
    unhideColumn,
    showAllColumns,
  };
};
