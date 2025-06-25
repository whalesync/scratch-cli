import { SnapshotRecord } from "./snapshot";

export type RecordOperation = {
  op: "create" | "update" | "delete";
  id: string;
  data?: Record<string, unknown>;
};

export type BulkUpdateRecordsDto = {
  ops: RecordOperation[];
};

export type ListRecordsResponse = {
  records: SnapshotRecord[];
  nextCursor?: string;
};
