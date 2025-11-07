import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { BulkUpdateRecordsDto, ListRecordsResponse, RecordOperation } from '@/types/server-entities/records';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { mutate as globalMutate } from 'swr';
import { SWR_KEYS } from '../../../../../lib/api/keys';
import { snapshotApi } from '../../../../../lib/api/snapshot';
import { SnapshotRecord } from '../../../../../types/server-entities/snapshot';

// This context is used to buffer updates to records and flush them in batches.
// As `addPendingChange(...)` is called, the edits edits are accumulated in memory and immediately applied to the cache.
// The `savePendingChanges(...)` method is used to flush the changes to the server.

export interface PendingRecordUpdate {
  snapshotId: string;
  tableId: string;
  operation: RecordOperation;
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

    // Group updates by snapshot+table to minimize cache iterations
    const groupedByTable: Record<string, PendingRecordUpdate[]> = {};
    for (const upd of updates) {
      const tableKey = `${upd.snapshotId}:${upd.tableId}`;
      if (!groupedByTable[tableKey]) {
        groupedByTable[tableKey] = [];
      }
      groupedByTable[tableKey].push(upd);
    }

    // Apply optimistic updates for each snapshot+table group
    for (const [, tableUpdates] of Object.entries(groupedByTable)) {
      const { snapshotId, tableId } = tableUpdates[0];
      const swrKeyMatcher = SWR_KEYS.snapshot.recordsKeyMatcher(snapshotId, tableId);
      const dto: BulkUpdateRecordsDto = {
        ops: tableUpdates.map((upd) => upd.operation),
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

    // Snapshot the current pending changes to flush
    const changesToFlush = [...pendingChanges];
    console.debug('savePendingChanges', changesToFlush.length, 'changes');

    try {
      // Step 1: Coalesce operations by record (last write wins for same field)
      const coalescedOps = coalesceOperations(changesToFlush);

      // Step 2: Group by snapshot+table
      const groupedByTable = groupByTable(coalescedOps);

      // Step 3: Apply optimistic updates and flush each table
      await Promise.all(
        Object.entries(groupedByTable).map(async ([, operations]) => {
          const { snapshotId, tableId } = operations[0];
          const dto: BulkUpdateRecordsDto = {
            ops: operations.map((update) => update.operation),
          };

          await bulkUpdateRecordsForTable(snapshotId, tableId, dto);
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
  return `${change.snapshotId}:${change.tableId}:${change.operation.wsId}:${change.operation.op}:${JSON.stringify(change.operation.data)}`;
}

// Coalesce operations by record - last write wins for the same field
function coalesceOperations(changes: PendingRecordUpdate[]): PendingRecordUpdate[] {
  // Group by snapshot+table+record
  const recordMap = new Map<string, PendingRecordUpdate>();

  for (const change of changes) {
    const recordKey = `${change.snapshotId}:${change.tableId}:${change.operation.wsId}`;
    const existing = recordMap.get(recordKey);

    if (!existing) {
      // First operation for this record - deep clone to avoid mutation
      recordMap.set(recordKey, {
        snapshotId: change.snapshotId,
        tableId: change.tableId,
        operation: {
          wsId: change.operation.wsId,
          op: change.operation.op,
          data: change.operation.data !== undefined ? { ...change.operation.data } : undefined,
        },
      });
    } else {
      // Merge operations - last write wins for each field
      if (change.operation.op === 'delete' || change.operation.op === 'undelete') {
        // Delete/undelete operations override everything
        existing.operation.op = change.operation.op;
        existing.operation.data = change.operation.data !== undefined ? { ...change.operation.data } : undefined;
      } else if (change.operation.op === 'update') {
        // For updates, merge the data fields (last write wins)
        if (change.operation.data !== undefined) {
          existing.operation.data = { ...existing.operation.data, ...change.operation.data };
        }
      } else if (change.operation.op === 'create') {
        // Create operations - merge data
        if (change.operation.data !== undefined) {
          existing.operation.data = { ...existing.operation.data, ...change.operation.data };
        }
      }
    }
  }

  return Array.from(recordMap.values());
}

// Group coalesced operations by snapshot+table
function groupByTable(operations: PendingRecordUpdate[]): Record<string, PendingRecordUpdate[]> {
  const groups: Record<string, PendingRecordUpdate[]> = {};

  for (const op of operations) {
    const tableKey = `${op.snapshotId}:${op.tableId}`;
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

  let newRecords = [...existingData.records];

  for (const op of dto.ops) {
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
    } else if (op.op === 'create') {
      if (recordIndex !== -1) {
        // Already exists, this is an error condition but we'll ignore it for optimistic updates.
        continue;
      }
      const newRecord: SnapshotRecord = {
        id: {
          wsId: op.wsId,
          remoteId: null,
        },
        fields: op.data ?? {},
        __edited_fields: { __created: 'NOW' },
        __dirty: true,
      };
      newRecords = [...newRecords, newRecord];
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
  snapshotId: string,
  tableId: string,
  dto: BulkUpdateRecordsDto,
): Promise<void> {
  const swrKeyMatcher = SWR_KEYS.snapshot.recordsKeyMatcher(snapshotId, tableId);

  try {
    // Apply optimistic updates to ALL paginated keys for this table
    await globalMutate(
      swrKeyMatcher,
      (data: ListRecordsResponse | undefined) => optimisticDataForBulkUpdateRecords(data, dto),
      { revalidate: false },
    );

    // Make the actual API call
    await snapshotApi.bulkUpdateRecords(snapshotId, tableId, dto);
  } catch (e) {
    // Re-throw the error so the calling component can handle it.
    throw e;
  } finally {
    // Always revalidate to get the canonical state from the server.
    // This handles all paginated keys
    await globalMutate(swrKeyMatcher);
  }
}
