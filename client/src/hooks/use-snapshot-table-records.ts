import { isUnauthorizedError } from '@/lib/api/error';
import { SWR_KEYS } from '@/lib/api/keys';
import { workbookApi } from '@/lib/api/workbook';
import { trackAcceptChanges, trackRejectChanges } from '@/lib/posthog';

import {
  ExistingChangeTypes,
  ProcessedFieldValue,
  processFieldValue,
} from '@/app/components/field-value-wrappers/ProcessedFieldValue';
import {
  AcceptAllSuggestionsResult,
  getSnapshotTableById,
  RejectAllSuggestionsResult,
  SNAPSHOT_RECORD_CREATED_FIELD,
  SNAPSHOT_RECORD_DELETED_FIELD,
  SnapshotRecord,
} from '@/types/server-entities/workbook';
import { hashStringList } from '@/utils/helpers';
import { SnapshotTableId, WorkbookId } from '@spinner/shared-types';
import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useWorkbook } from './use-workbook';

export type ProcessedSnapshotRecord = SnapshotRecord & {
  __processed_fields: Record<string, ProcessedFieldValue>;
  isTableDirty: boolean;
};

export interface UseSnapshotRecordsReturn {
  records: ProcessedSnapshotRecord[] | undefined;
  columnChangeTypes: Record<string, ExistingChangeTypes>;
  recordDataHash: number;
  isLoading: boolean;
  error: Error | undefined;
  refreshRecords: () => Promise<void>;
  acceptCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  rejectCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  count: number;
  filteredCount: number;
  skip: number;
  take: number;
  startIndex: number;
  endIndex: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
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
  skip?: number;
  take?: number;
  generateHash?: boolean;
}): UseSnapshotRecordsReturn => {
  const { workbookId, tableId, skip, take = 1000, generateHash = false } = args;
  const { workbook } = useWorkbook(workbookId);
  const swrKey = workbookId && tableId ? SWR_KEYS.workbook.records(workbookId, tableId, skip, take) : null;

  const { mutate } = useSWRConfig();

  const { data, error, isLoading } = useSWR(
    tableId ? swrKey : null,
    () =>
      workbookId && tableId
        ? workbookApi.listRecords(workbookId, tableId, skip, take, skip === undefined) // Use stored skip when no skip provided
        : undefined,
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
    if (workbookId) {
      await mutate(SWR_KEYS.operationCounts.get(workbookId));
    }
  }, [mutate, swrKey, workbookId]);

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
        await mutate(SWR_KEYS.operationCounts.get(workbookId));
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
    await mutate(SWR_KEYS.operationCounts.get(workbookId));
    return result;
  }, [mutate, tableId, workbookId]);

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
    if (workbookId) {
      await mutate(SWR_KEYS.operationCounts.get(workbookId));
    }
  }, [workbook, tableId, mutate, swrKey, workbookId]);

  const displayError = useMemo(() => {
    if (isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  // Process records to calculate field changes and aggregate column change types
  const { processedRecords, columnChangeTypes } = useMemo(() => {
    if (!data?.records || !workbook || !tableId) {
      return { processedRecords: undefined, columnChangeTypes: {} };
    }

    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable?.tableSpec) {
      // If no table spec available, return records with empty processed fields
      return {
        processedRecords: data.records.map(
          (record): ProcessedSnapshotRecord => ({
            ...record,
            __processed_fields: {},
            isTableDirty: false,
          }),
        ),
        columnChangeTypes: {},
      };
    }

    const tableSpec = snapshotTable.tableSpec;
    const columnChanges: Record<string, ExistingChangeTypes> = {};

    // Initialize column change tracking for all columns
    tableSpec.columns.forEach((columnDef) => {
      const fieldId = columnDef.id.wsId;
      if (fieldId !== 'id') {
        columnChanges[fieldId] = {
          suggestedAdditions: false,
          suggestedDeletions: false,
          acceptedAdditions: false,
          acceptedDeletions: false,
        };
      }
    });

    const records = data.records.map((record): ProcessedSnapshotRecord => {
      const processedFields: Record<string, ProcessedFieldValue> = {};

      // Process each column in the table spec
      tableSpec.columns.forEach((columnDef) => {
        const fieldId = columnDef.id.wsId;
        if (fieldId === 'id') return; // Skip the ID column

        const value = record.fields?.[fieldId];
        const processed = processFieldValue(value, record, columnDef);
        processedFields[fieldId] = processed;

        // Aggregate change types for this column (OR operation - if any record has it, column has it)
        const columnChange = columnChanges[fieldId];
        if (processed.existingChangeTypes.suggestedAdditions) {
          columnChange.suggestedAdditions = true;
        }
        if (processed.existingChangeTypes.suggestedDeletions) {
          columnChange.suggestedDeletions = true;
        }
        if (processed.existingChangeTypes.acceptedAdditions) {
          columnChange.acceptedAdditions = true;
        }
        if (processed.existingChangeTypes.acceptedDeletions) {
          columnChange.acceptedDeletions = true;
        }
      });

      return {
        ...record,
        __processed_fields: processedFields,
        isTableDirty: snapshotTable.dirty,
      };
    });

    return { processedRecords: records, columnChangeTypes: columnChanges };
  }, [data?.records, workbook, tableId]);

  // Calculate pagination info
  const currentSkip = data?.skip ?? 0;
  const currentTake = data?.take ?? take;
  const totalCount = data?.filteredCount ?? 0;

  const startIndex = currentSkip + 1; // 1-based
  const endIndex = currentSkip + (data?.records?.length ?? 0);
  const hasNextPage = endIndex < totalCount;
  const hasPrevPage = currentSkip > 0;

  return {
    records: processedRecords,
    columnChangeTypes,
    recordDataHash,
    skip: currentSkip,
    take: currentTake,
    startIndex,
    endIndex,
    hasNextPage,
    hasPrevPage,
    isLoading,
    error: displayError, // show a sanitized error message to the user to avoid exposing the exception details
    refreshRecords,
    acceptCellValues,
    rejectCellValues,
    count: data?.count || 0,
    filteredCount: totalCount,
    recordsWithSuggestions,
    totalSuggestions,
    totalSuggestedDeletes,
    totalSuggestedCreates,
    acceptAllSuggestions,
    rejectAllSuggestions,
    createNewRecord,
  };
};
