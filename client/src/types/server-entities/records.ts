import { SnapshotRecord } from './workbook';

export type CreateRecordOperation = {
  op: 'create';
  data: Record<string, unknown>;
};

export type UpdateRecordOperation = {
  op: 'update';
  wsId: string;
  data: Record<string, unknown>;
};

export type DeleteRecordOperation = {
  op: 'delete';
  wsId: string;
};

export type UndeleteRecordOperation = {
  op: 'undelete';
  wsId: string;
  data: Record<string, unknown>;
};

export type RecordOperation =
  | CreateRecordOperation
  | UpdateRecordOperation
  | DeleteRecordOperation
  | UndeleteRecordOperation;

// Type for operations that can be enqueued (excludes create since those are handled immediately via API)
// Makes things a bit more simple. We don't need to create temp ids on the client
// And all enqueueable operations will have wsId
export type EnqueueableRecordOperation = UpdateRecordOperation | DeleteRecordOperation | UndeleteRecordOperation;

export type BulkUpdateRecordsDto = {
  ops: RecordOperation[];
};

export interface ListRecordsResponse {
  records: SnapshotRecord[];
  nextCursor?: string;
  count: number;
  filteredCount: number;
}
