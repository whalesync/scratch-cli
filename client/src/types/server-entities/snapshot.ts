export interface Snapshot {
  id: string;
  createdAt: string;
  updatedAt: string;
  connectorAccountId: string;
}

export interface CreateSnapshotDto {
  connectorAccountId: string;
}
