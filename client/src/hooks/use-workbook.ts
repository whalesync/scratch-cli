import { isUnauthorizedError } from '@/lib/api/error';
import { SWR_KEYS } from '@/lib/api/keys';
import { recordApi } from '@/lib/api/record';
import { workbookApi } from '@/lib/api/workbook';
import { AddTableToWorkbookDto, UpdateWorkbookDto } from '@/types/server-entities/workbook';
import {
  EntityId,
  Service,
  SnapshotColumnSettingsMap,
  SnapshotTable,
  SnapshotTableId,
  Workbook,
  WorkbookId,
} from '@spinner/shared-types';
import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ScratchpadNotifications } from '../app/components/ScratchpadNotifications';

export interface UseWorkbookReturn {
  workbook: Workbook | undefined;
  isLoading: boolean;
  error: Error | undefined;
  publish: () => Promise<void>;
  refreshWorkbook: () => Promise<void>;
  updateWorkbook: (updateDto: UpdateWorkbookDto) => Promise<void>;
  updateColumnSettings: (tableId: SnapshotTableId, columnSettings: SnapshotColumnSettingsMap) => Promise<void>;
  clearActiveRecordFilter: (tableId: SnapshotTableId) => Promise<void>;
  hideTable: (tableId: SnapshotTableId) => Promise<void>;
  unhideTable: (tableId: SnapshotTableId) => Promise<void>;
  deleteTable: (tableId: SnapshotTableId) => Promise<void>;
  hideColumn: (tableId: SnapshotTableId, columnId: string) => Promise<void>;
  unhideColumn: (tableId: SnapshotTableId, columnId: string) => Promise<void>;
  showAllColumns: (tableId: SnapshotTableId) => Promise<void>;
  addTable: (tableId: EntityId, service: Service, connectorAccountId?: string) => Promise<SnapshotTable>;
}

export const useWorkbook = (id: WorkbookId | null): UseWorkbookReturn => {
  const { data, error, isLoading, mutate } = useSWR(
    id ? SWR_KEYS.workbook.detail(id) : null,
    () => (id ? workbookApi.detail(id) : undefined),
    {
      revalidateOnFocus: false,
    },
  );

  const { mutate: globalMutate } = useSWRConfig();

  const refreshWorkbook = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const publish = useCallback(async () => {
    if (!data || !id) {
      return;
    }

    await workbookApi.publish(id);
    // Revalidate the workbook itself
    await mutate();

    // Revalidate the records in all tables for this workbook.
    globalMutate(
      (key) => Array.isArray(key) && key[0] === 'workbook' && key[1] === 'records' && key[2] === id,
      undefined,
      { revalidate: true },
    );
    globalMutate(SWR_KEYS.operationCounts.get(id), undefined, { revalidate: true });
  }, [id, data, mutate, globalMutate]);

  const displayError = useMemo(() => {
    if (isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  const updateWorkbook = useCallback(
    async (updateDto: UpdateWorkbookDto): Promise<void> => {
      if (!id) {
        return;
      }
      await workbookApi.update(id, updateDto);
      globalMutate(SWR_KEYS.workbook.list());
      globalMutate(SWR_KEYS.workbook.detail(id));
    },
    [globalMutate, id],
  );

  const updateColumnSettings = useCallback(
    async (tableId: SnapshotTableId, columnSettings: SnapshotColumnSettingsMap): Promise<void> => {
      if (!id) {
        return;
      }
      await workbookApi.updateColumnSettings(id, tableId, { columnSettings });
      globalMutate(SWR_KEYS.workbook.detail(id));
    },
    [globalMutate, id],
  );

  const clearActiveRecordFilter = useCallback(
    async (tableId: SnapshotTableId) => {
      if (!id) {
        return;
      }

      try {
        await recordApi.clearActiveRecordFilter(id, tableId);
        ScratchpadNotifications.success({
          title: 'Filter Cleared',
          message: 'All records are now visible',
        });

        // Invalidate records cache to refresh the data
        globalMutate(
          (key) => Array.isArray(key) && key[0] === 'workbook' && key[1] === 'records' && key[2] === id,
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
    async (tableId: SnapshotTableId) => {
      if (!id) {
        return;
      }
      await workbookApi.hideTable(id, tableId, true);
      await mutate();
    },
    [id, mutate],
  );

  const unhideTable = useCallback(
    async (tableId: SnapshotTableId) => {
      if (!id) {
        return;
      }
      await workbookApi.hideTable(id, tableId, false);
      await mutate();
    },
    [id, mutate],
  );

  const deleteTable = useCallback(
    async (tableId: SnapshotTableId) => {
      if (!id) {
        return;
      }
      await workbookApi.deleteTable(id, tableId);
      await mutate();
    },
    [id, mutate],
  );

  const hideColumn = useCallback(
    async (tableId: SnapshotTableId, columnId: string) => {
      if (!id) {
        return;
      }
      await workbookApi.hideColumn(id, tableId, columnId);
      await mutate();
    },
    [id, mutate],
  );

  const unhideColumn = useCallback(
    async (tableId: SnapshotTableId, columnId: string) => {
      if (!id) {
        return;
      }
      await workbookApi.unhideColumn(id, tableId, columnId);
      await mutate();
    },
    [id, mutate],
  );

  const showAllColumns = useCallback(
    async (tableId: SnapshotTableId) => {
      if (!id) {
        return;
      }
      await workbookApi.clearHiddenColumns(id, tableId);
      await mutate();
    },
    [id, mutate],
  );

  const addTable = useCallback(
    async (tableId: EntityId, service: Service, connectorAccountId?: string): Promise<SnapshotTable> => {
      if (!id) {
        throw new Error('Workbook not found');
      }

      const dto: AddTableToWorkbookDto = { tableId, service, connectorAccountId };
      const snapshotTable = await workbookApi.addTable(id, dto);
      await mutate();
      return snapshotTable;
    },
    [id, mutate],
  );

  return {
    workbook: data,
    isLoading,
    error: displayError,
    publish,
    refreshWorkbook,
    updateWorkbook,
    updateColumnSettings,
    clearActiveRecordFilter,
    hideTable,
    unhideTable,
    deleteTable,
    hideColumn,
    unhideColumn,
    showAllColumns,
    addTable,
  };
};
