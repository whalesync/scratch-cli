export interface EntityId {
  wsId: string;
  remoteId: string[];
}

export interface TablePreview {
  id: EntityId;
  displayName: string;
}

export interface TableList {
  tables: TablePreview[];
}
