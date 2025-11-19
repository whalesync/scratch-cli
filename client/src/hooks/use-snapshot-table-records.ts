import { isUnauthorizedError } from '@/lib/api/error';
import { SWR_KEYS } from '@/lib/api/keys';
import { workbookApi } from '@/lib/api/workbook';
import { trackAcceptChanges, trackRejectChanges } from '@/lib/posthog';

import {
  AcceptAllSuggestionsResult,
  getSnapshotTableById,
  RejectAllSuggestionsResult,
  SNAPSHOT_RECORD_CREATED_FIELD,
  SNAPSHOT_RECORD_DELETED_FIELD,
  SnapshotRecord,
} from '@/types/server-entities/workbook';
import { hashStringList } from '@/utils/helpers';
import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { SnapshotTableId, WorkbookId } from '../types/server-entities/ids';
import { useWorkbook } from './use-workbook';

export interface UseSnapshotRecordsReturn {
  records: SnapshotRecord[] | undefined;
  recordDataHash: number;
  isLoading: boolean;
  error: Error | undefined;
  refreshRecords: () => Promise<void>;
  acceptCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  rejectCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  count: number;
  filteredCount: number;
  recordsWithSuggestions: number;
  totalSuggestions: number;
  totalSuggestedDeletes: number;
  totalSuggestedCreates: number;
  acceptAllSuggestions: () => Promise<AcceptAllSuggestionsResult>;
  rejectAllSuggestions: () => Promise<RejectAllSuggestionsResult>;
  createNewRecord: () => Promise<void>;
}

export const useSnapshotTableRecords = (args: {
  workbookId: WorkbookId | null;
  tableId: SnapshotTableId | null;
  cursor?: string;
  take?: number;
  generateHash?: boolean;
}): UseSnapshotRecordsReturn => {
  const { workbookId, tableId, cursor, take = 1000, generateHash = false } = args;
  const { workbook } = useWorkbook(workbookId);
  const swrKey = workbookId && tableId ? SWR_KEYS.workbook.records(workbookId, tableId, cursor, take) : null;

  const { mutate } = useSWRConfig();

  const { data, error, isLoading } = useSWR(
    tableId ? swrKey : null,
    () => (workbookId && tableId ? workbookApi.listRecords(workbookId, tableId, cursor, take) : undefined),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      keepPreviousData: true, // Keep previous data during revalidation to prevent flicker
    },
  );

  const recordDataHash = useMemo(() => {
    if (generateHash) {
      return hashStringList(data?.records?.map((r) => r.id.wsId) ?? []);
    }
    return -1;
  }, [data?.records, generateHash]);

  const refreshRecords = useCallback(async () => {
    await mutate(swrKey);
  }, [mutate, swrKey]);

  const acceptCellValues = useCallback(
    async (items: { wsId: string; columnId: string }[]) => {
      if (!workbookId || !tableId) return;
      try {
        await workbookApi.acceptCellValues(workbookId, tableId, items);
        trackAcceptChanges(items, workbook);
      } catch (e) {
        // Re-throw the error so the calling component can handle it.
        throw e;
      } finally {
        // Always revalidate to get the canonical state from the server.
        await mutate(swrKey);
      }
    },
    [workbookId, tableId, mutate, swrKey, workbook],
  );

  const rejectCellValues = useCallback(
    async (items: { wsId: string; columnId: string }[]) => {
      if (!workbookId || !tableId) return;
      try {
        await workbookApi.rejectCellValues(workbookId, tableId, items);
        trackRejectChanges(items, workbook);
      } catch (e) {
        // Re-throw the error so the calling component can handle it.
        throw e;
      } finally {
        // Always revalidate to get the canonical state from the server.
        await mutate(swrKey);
      }
    },
    [workbookId, tableId, mutate, swrKey, workbook],
  );

  const { recordsWithSuggestions, totalSuggestions, totalSuggestedDeletes, totalSuggestedCreates } = useMemo(() => {
    let recordsWithSuggestions = 0;
    let totalSuggestions = 0;
    let totalSuggestedDeletes = 0;
    let totalSuggestedCreates = 0;
    if (data?.records) {
      for (const record of data.records) {
        const columnsWithSuggestions = Object.keys(record.__suggested_values ?? {}).filter(
          (key) =>
            key === SNAPSHOT_RECORD_DELETED_FIELD ||
            key === SNAPSHOT_RECORD_CREATED_FIELD ||
            (!key.startsWith('__') && key !== 'id'),
        );
        if (columnsWithSuggestions.length > 0) {
          recordsWithSuggestions++;
          totalSuggestions += columnsWithSuggestions.length;
        }
        if (record.__suggested_values?.[SNAPSHOT_RECORD_DELETED_FIELD]) {
          totalSuggestedDeletes++;
        }
        if (record.__suggested_values?.[SNAPSHOT_RECORD_CREATED_FIELD]) {
          totalSuggestedCreates++;
        }
      }
    }

    return {
      recordsWithSuggestions,
      totalSuggestions,
      totalSuggestedDeletes,
      totalSuggestedCreates,
    };
  }, [data]);

  const acceptAllSuggestions = useCallback(async () => {
    if (!tableId || !workbookId) return { recordsUpdated: 0, totalChangesAccepted: 0 };
    const result = await workbookApi.acceptAllSuggestions(workbookId, tableId);
    return result;
  }, [tableId, workbookId]);

  const rejectAllSuggestions = useCallback(async () => {
    if (!tableId || !workbookId) return { recordsRejected: 0, totalChangesRejected: 0 };
    const result = await workbookApi.rejectAllSuggestions(workbookId, tableId);
    return result;
  }, [tableId, workbookId]);

  const createNewRecord = useCallback(async () => {
    if (!workbook || !tableId) return;
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new Error(`Table ${tableId} not found in workbook ${workbookId}`);
    }
    const tableSpec = snapshotTable.tableSpec;

    if (!tableSpec) return;

    const newRecordData: Record<string, unknown> = {};

    tableSpec.columns.forEach((c) => {
      if (c.id.wsId !== 'id') {
        newRecordData[c.id.wsId] = null;
      }
    });

    // Create the record on the server - this will trigger a workbook edited event
    await workbookApi.bulkUpdateRecords(workbook.id, snapshotTable.id, {
      creates: [
        {
          op: 'create',
          data: newRecordData,
        },
      ],
      updates: [],
      deletes: [],
      undeletes: [],
    });

    // Refresh records to get the newly created record
    await mutate(swrKey);
  }, [workbook, tableId, mutate, swrKey, workbookId]);

  const displayError = useMemo(() => {
    if (isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  return {
    records: data?.records ?? undefined,
    recordDataHash,
    isLoading,
    error: displayError, // show a sanitized error message to the user to avoid exposing the exception details
    refreshRecords,
    acceptCellValues,
    rejectCellValues,
    count: data?.count || 0,
    filteredCount: data?.filteredCount || 0,
    recordsWithSuggestions,
    totalSuggestions,
    totalSuggestedDeletes,
    totalSuggestedCreates,
    acceptAllSuggestions,
    rejectAllSuggestions,
    createNewRecord,
  };
};
