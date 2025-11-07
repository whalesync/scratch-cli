import { generatePendingId } from '@/app/snapshots/[...slug]/components/helpers';
import { isUnauthorizedError } from '@/lib/api/error';
import { SWR_KEYS } from '@/lib/api/keys';
import { snapshotApi } from '@/lib/api/snapshot';
import { trackAcceptChanges, trackRejectChanges } from '@/lib/posthog';

import {
  AcceptAllSuggestionsResult,
  getTableSpecByWsId,
  RejectAllSuggestionsResult,
  SNAPSHOT_RECORD_CREATED_FIELD,
  SNAPSHOT_RECORD_DELETED_FIELD,
  SnapshotRecord,
} from '@/types/server-entities/snapshot';
import { hashStringList } from '@/utils/helpers';
import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useUpdateRecordsContext } from '../app/snapshots/[...slug]/components/contexts/update-records-context';
import { useSnapshot } from './use-snapshot';

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
  snapshotId: string;
  tableId: string;
  cursor?: string;
  take?: number;
  generateHash?: boolean;
}): UseSnapshotRecordsReturn => {
  const { snapshotId, tableId, cursor, take = 1000, generateHash = false } = args;
  const { snapshot } = useSnapshot(snapshotId);
  const swrKey = SWR_KEYS.snapshot.records(snapshotId, tableId, cursor, take);
  const { addPendingChange } = useUpdateRecordsContext();

  const { mutate } = useSWRConfig();

  const { data, error, isLoading } = useSWR(
    tableId ? swrKey : null,
    () => snapshotApi.listRecords(snapshotId, tableId, cursor, take),
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
      try {
        await snapshotApi.acceptCellValues(snapshotId, tableId, items);
        trackAcceptChanges(items, snapshot);
      } catch (e) {
        // Re-throw the error so the calling component can handle it.
        throw e;
      } finally {
        // Always revalidate to get the canonical state from the server.
        await mutate(swrKey);
      }
    },
    [snapshotId, tableId, mutate, swrKey, snapshot],
  );

  const rejectCellValues = useCallback(
    async (items: { wsId: string; columnId: string }[]) => {
      try {
        await snapshotApi.rejectCellValues(snapshotId, tableId, items);
        trackRejectChanges(items, snapshot);
      } catch (e) {
        // Re-throw the error so the calling component can handle it.
        throw e;
      } finally {
        // Always revalidate to get the canonical state from the server.
        await mutate(swrKey);
      }
    },
    [snapshotId, tableId, mutate, swrKey, snapshot],
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
    if (!tableId || !snapshotId) return { recordsUpdated: 0, totalChangesAccepted: 0 };
    const result = await snapshotApi.acceptAllSuggestions(snapshotId, tableId);
    return result;
  }, [tableId, snapshotId]);

  const rejectAllSuggestions = useCallback(async () => {
    if (!tableId || !snapshotId) return { recordsRejected: 0, totalChangesRejected: 0 };
    const result = await snapshotApi.rejectAllSuggestions(snapshotId, tableId);
    return result;
  }, [tableId, snapshotId]);

  const createNewRecord = useCallback(async () => {
    if (!snapshot) return;
    const table = getTableSpecByWsId(snapshot, tableId);

    if (!table) return;
    const newRecordId = generatePendingId();

    const newRecordData: Record<string, unknown> = {
      id: newRecordId,
    };

    table.columns.forEach((c) => {
      if (c.id.wsId !== 'id') {
        newRecordData[c.id.wsId] = null;
      }
    });

    addPendingChange({
      snapshotId: snapshot.id,
      tableId: table.id.wsId,
      operation: {
        op: 'create',
        wsId: newRecordId,
        data: newRecordData,
      },
    });
  }, [snapshot, tableId, addPendingChange]);

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
