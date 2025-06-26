import { SnapshotRecord } from "./snapshot.js";

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
