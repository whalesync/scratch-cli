import { SnapshotRecord } from './workbook';

/**
 * Keep in sync with spinner/server/src/workbook/dto/bulk-update-records.dto.ts.
 */
export type RecordOperation =
  | CreateRecordOperation
  | UpdateRecordOperation
  | DeleteRecordOperation
  | UndeleteRecordOperation;

/**
 * Keep in sync with spinner/server/src/workbook/dto/bulk-update-records.dto.ts.
 */
export type CreateRecordOperation = {
  op: 'create';

  data: Record<string, unknown>;
};

/**
 * Keep in sync with spinner/server/src/workbook/dto/bulk-update-records.dto.ts.
 */
export type UpdateRecordOperation = {
  op: 'update';

  wsId: string;

  data: Record<string, unknown>;
};

/**
 * Keep in sync with spinner/server/src/workbook/dto/bulk-update-records.dto.ts.
 */
export type DeleteRecordOperation = {
  op: 'delete';

  wsId: string;
};

/**
 * Keep in sync with spinner/server/src/workbook/dto/bulk-update-records.dto.ts.
 */
export type UndeleteRecordOperation = {
  op: 'undelete';

  wsId: string;
};

/**
 * Keep in sync with spinner/server/src/workbook/dto/bulk-update-records.dto.ts.
 */
export type BulkUpdateRecordsDto = {
  creates: CreateRecordOperation[];

  updates: UpdateRecordOperation[];

  deletes: DeleteRecordOperation[];

  undeletes: UndeleteRecordOperation[];
};

// Type for operations that can be enqueued (excludes create since those are handled immediately via API)
// Makes things a bit more simple. We don't need to create temp ids on the client
// And all enqueueable operations will have wsId
export type EnqueueableRecordOperation = UpdateRecordOperation | DeleteRecordOperation | UndeleteRecordOperation;
export interface ListRecordsResponse {
  records: SnapshotRecord[];
  count: number;
  filteredCount: number;
  skip: number;
  take: number;
}

export type SetTableViewStateDto = {
  pageSize?: number | null;
  currentSkip?: number | null;
};
