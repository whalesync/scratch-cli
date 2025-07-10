import { SnapshotRecord } from "./snapshot";

export type RecordOperation = {
  op: "create" | "update" | "delete" | "undelete";
  wsId: string;
  data?: Record<string, unknown>;
};

export type BulkUpdateRecordsDto = {
  ops: RecordOperation[];
};

export type ListRecordsResponse = {
  records: SnapshotRecord[];
  nextCursor?: string;
};
