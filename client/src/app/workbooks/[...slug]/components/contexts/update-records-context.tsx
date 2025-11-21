import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import {
  BulkUpdateRecordsDto,
  EnqueueableRecordOperation,
  ListRecordsResponse,
  RecordOperation,
  UpdateRecordOperation,
} from '@/types/server-entities/records';
import _ from 'lodash';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { mutate as globalMutate } from 'swr';
import { SWR_KEYS } from '../../../../../lib/api/keys';
import { workbookApi } from '../../../../../lib/api/workbook';
import { SnapshotTableId, WorkbookId } from '../../../../../types/server-entities/ids';

// This context is used to buffer updates to records and flush them in batches.
// As `addPendingChange(...)` is called, the edits edits are accumulated in memory and immediately applied to the cache.
// The `savePendingChanges(...)` method is used to flush the changes to the server.

export interface PendingRecordUpdate {
  workbookId: WorkbookId;
  tableId: SnapshotTableId;
  operation: EnqueueableRecordOperation;
}

interface UpdateRecordsValue {
  addPendingChange: (...updates: PendingRecordUpdate[]) => void;
  savePendingChanges: () => Promise<void>;
  pendingChanges: PendingRecordUpdate[];
  savingPendingChanges: boolean;
}

const UpdateRecordsContext = createContext<UpdateRecordsValue | undefined>(undefined);

export const UpdateRecordsProvider = ({ children }: { children: ReactNode }) => {
  const [pendingChanges, setPendingChanges] = useState<PendingRecordUpdate[]>([]);
  const [savingPendingChanges, setSavingPendingChanges] = useState(false);

  // Use a ref to track if a flush is in progress to prevent race conditions
  const flushInProgressRef = useRef(false);
  // Use a ref to track changes that arrived during a flush
  const changesArrivedDuringFlushRef = useRef(false);

  /** API */

  const addPendingChange = useCallback((...updates: PendingRecordUpdate[]) => {
    console.debug('addPendingChange', updates.length, 'update(s)');

    // Track if a change arrived during flush
    if (flushInProgressRef.current) {
      changesArrivedDuringFlushRef.current = true;
    }

    // Group updates by workbook+table to minimize cache iterations
    const groupedByTable: Record<string, PendingRecordUpdate[]> = {};
    for (const upd of updates) {
      const tableKey = `${upd.workbookId}:${upd.tableId}`;
      if (!groupedByTable[tableKey]) {
        groupedByTable[tableKey] = [];
      }
      groupedByTable[tableKey].push(upd);
    }

    // Apply optimistic updates for each workbook+table group
    for (const [, tableUpdates] of Object.entries(groupedByTable)) {
      const { workbookId, tableId } = tableUpdates[0];
      const swrKeyMatcher = SWR_KEYS.workbook.recordsKeyMatcher(workbookId, tableId);
      const dto: BulkUpdateRecordsDto = {
        creates: [],
        updates: tableUpdates.map((upd) => upd.operation).filter((op) => op.op === 'update'),
        deletes: tableUpdates.map((upd) => upd.operation).filter((op) => op.op === 'delete'),
        undeletes: tableUpdates.map((upd) => upd.operation).filter((op) => op.op === 'undelete'),
      };

      // Update all paginated keys for this table optimistically (no revalidate)
      globalMutate(
        swrKeyMatcher,
        (data: ListRecordsResponse | undefined) => optimisticDataForBulkUpdateRecords(data, dto),
        { revalidate: false },
      );
    }

    setPendingChanges((currentPendingChanges) => {
      return [...currentPendingChanges, ...updates];
    });
  }, []);

  const savePendingChanges = useCallback(async () => {
    // Prevent concurrent flushes
    if (flushInProgressRef.current) {
      console.debug('Flush already in progress, skipping');
      return;
    }

    if (pendingChanges.length === 0) {
      return;
    }

    flushInProgressRef.current = true;
    changesArrivedDuringFlushRef.current = false;
    setSavingPendingChanges(true);

    // workbook the current pending changes to flush
    const changesToFlush = [...pendingChanges];

    try {
      // Step 1: Coalesce operations by record (last write wins for same field)
      const coalescedOps = coalesceOperations(changesToFlush);

      // Step 2: Group by workbook+table
      const groupedByTable = groupByTable(coalescedOps);

      // Step 3: Apply optimistic updates and flush each table
      await Promise.all(
        Object.entries(groupedByTable).map(async ([, operations]) => {
          const { workbookId, tableId } = operations[0];
          const dto: BulkUpdateRecordsDto = {
            creates: [],
            updates: operations.map((update) => update.operation).filter((op) => op.op === 'update'),
            deletes: operations.map((update) => update.operation).filter((op) => op.op === 'delete'),
            undeletes: operations.map((update) => update.operation).filter((op) => op.op === 'undelete'),
          };

          await bulkUpdateRecordsForTable(workbookId, tableId, dto);
        }),
      );

      // Step 4: Only clear the changes that were flushed
      // If new changes arrived during flush, keep them
      setPendingChanges((current) => {
        // Remove only the changes we just flushed
        const flushedIds = new Set(changesToFlush.map((c) => getChangeId(c)));
        return current.filter((c) => !flushedIds.has(getChangeId(c)));
      });
    } catch (e) {
      const error = e as Error;
      console.error('Error flushing pending updates', error);
      ScratchpadNotifications.error({
        title: 'Error updating fields',
        message: error.message,
      });
      // Don't clear pending changes on error - they'll be retried
    } finally {
      flushInProgressRef.current = false;
      setSavingPendingChanges(false);

      // If changes arrived during flush, schedule another flush
      if (changesArrivedDuringFlushRef.current) {
        console.debug('Changes arrived during flush, scheduling another flush');
        setTimeout(() => {
          savePendingChanges();
        }, 100);
      }
    }
  }, [pendingChanges]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!savingPendingChanges && pendingChanges.length > 0) {
        savePendingChanges();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [savePendingChanges, savingPendingChanges, pendingChanges.length]);

  const value: UpdateRecordsValue = {
    addPendingChange,
    savePendingChanges,
    pendingChanges,
    savingPendingChanges,
  };

  return <UpdateRecordsContext.Provider value={value}>{children}</UpdateRecordsContext.Provider>;
};

export const useUpdateRecordsContext = () => {
  const context = useContext(UpdateRecordsContext);
  if (context === undefined) {
    throw new Error('useUpdateRecordContext must be used within a UpdateRecordsProvider');
  }
  return context;
};

/**
 * Helper functions for the buffered updater
 */

// Generate a unique ID for a change to track which ones we've flushed
function getChangeId(change: PendingRecordUpdate): string {
  const dataStr = change.operation.op === 'update' ? JSON.stringify(change.operation.data) : '';
  return `${change.workbookId}:${change.tableId}:${change.operation.wsId}:${change.operation.op}:${dataStr}`;
}

// Coalesce operations by record - last write wins for the same field
function coalesceOperations(changes: PendingRecordUpdate[]): PendingRecordUpdate[] {
  // Group by workbook+table+record
  const recordMap = new Map<string, PendingRecordUpdate>();

  for (const change of changes) {
    const recordKey = `${change.workbookId}:${change.tableId}:${change.operation.wsId}`;
    const existing = recordMap.get(recordKey);

    const changeOperation = change.operation;
    if (!existing) {
      // First operation for this record - deep clone to avoid mutation
      recordMap.set(recordKey, change);
    } else if (changeOperation.op === 'delete' || changeOperation.op === 'undelete') {
      // Delete/undelete operations override everything
      recordMap.set(recordKey, change);
    } else {
      if (existing.operation.op === 'update' || existing.operation.op === 'undelete') {
        const existingOperation = existing.operation as UpdateRecordOperation;
        existingOperation.data = { ...existingOperation.data, ...changeOperation.data };
      } else {
        // Drop changes if adding on top of a delete
      }
    }
  }

  return Array.from(recordMap.values());
}

// Group coalesced operations by workbook+table
function groupByTable(operations: PendingRecordUpdate[]): Record<string, PendingRecordUpdate[]> {
  const groups: Record<string, PendingRecordUpdate[]> = {};

  for (const op of operations) {
    const tableKey = `${op.workbookId}:${op.tableId}`;
    if (!groups[tableKey]) {
      groups[tableKey] = [];
    }
    groups[tableKey].push(op);
  }

  return groups;
}

// We don't have to handle rollbacks, because the revalidate will pull the canonical state from the server.
function optimisticDataForBulkUpdateRecords(
  existingData: ListRecordsResponse | undefined,
  dto: BulkUpdateRecordsDto,
): ListRecordsResponse | undefined {
  if (!existingData) {
    return undefined;
  }

  const newRecords = [...existingData.records];

  const ops = _.concat<RecordOperation>(dto.creates, dto.updates, dto.deletes, dto.undeletes);
  for (const op of ops) {
    if (op.op === 'create') {
      console.error('Create operation not supported in optimistic data for bulk update records');
      continue;
    }
    const recordIndex = newRecords.findIndex((r) => r.id.wsId === op.wsId);

    if (op.op === 'update') {
      if (recordIndex === -1) {
        continue;
      }

      // Clone the record to avoid mutating the original cache
      const record = { ...newRecords[recordIndex] };

      // Update the data fields
      if (op.data !== undefined) {
        record.fields = { ...record.fields, ...op.data };
      }

      // Update the edited fields metadata
      const newEditedFields = { ...(record.__edited_fields || {}) };
      if (op.data !== undefined) {
        for (const key of Object.keys(op.data)) {
          newEditedFields[key] = 'NOW';
        }
      }
      record.__edited_fields = newEditedFields;
      newRecords[recordIndex] = record;
    } else if (op.op === 'delete') {
      if (recordIndex === -1) {
        continue;
      }
      const record = { ...newRecords[recordIndex] };
      record.__edited_fields = { __deleted: 'NOW' };
      newRecords[recordIndex] = record;
    } else if (op.op === 'undelete') {
      if (recordIndex === -1) {
        continue;
      }
      const record = { ...newRecords[recordIndex] };
      // Remove the deleted flag
      const newEditedFields = { ...(record.__edited_fields || {}) };
      delete newEditedFields.__deleted;
      record.__edited_fields = newEditedFields;
      newRecords[recordIndex] = record;
    }
  }

  const newData: ListRecordsResponse = {
    ...existingData,
    records: newRecords,
  };
  return newData;
}

// Bulk update records for a single table with optimistic updates across all paginated keys
async function bulkUpdateRecordsForTable(
  workbookId: WorkbookId,
  tableId: SnapshotTableId,
  dto: BulkUpdateRecordsDto,
): Promise<void> {
  const swrKeyMatcher = SWR_KEYS.workbook.recordsKeyMatcher(workbookId, tableId);

  try {
    // Apply optimistic updates to ALL paginated keys for this table
    await globalMutate(
      swrKeyMatcher,
      (data: ListRecordsResponse | undefined) => optimisticDataForBulkUpdateRecords(data, dto),
      { revalidate: false },
    );

    // Make the actual API call
    await workbookApi.bulkUpdateRecords(workbookId, tableId, dto);
  } catch (e) {
    // Re-throw the error so the calling component can handle it.
    throw e;
  } finally {
    // Always revalidate to get the canonical state from the server.
    // This handles all paginated keys
    await globalMutate(swrKeyMatcher);
    globalMutate(SWR_KEYS.operationCounts.get(workbookId));
  }
}
