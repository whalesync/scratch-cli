export enum SnapshotStatus {
  CREATING = "CREATING",
  EDITING = "EDITING",
  COMMITTING = "COMMITTING",
  DONE = "DONE",
  CANCELLED = "CANCELLED",
}

export interface Snapshot {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: SnapshotStatus;
  connectorAccountId: string;
}

export interface CreateSnapshotDto {
  connectorAccountId: string;
}

export interface UpdateSnapshotDto {
  status: SnapshotStatus.COMMITTING | SnapshotStatus.CANCELLED;
}
