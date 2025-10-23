export interface EntityId {
  wsId: string;
  remoteId: string[];
}

export interface ColumnSpec {
  id: EntityId;
  name: string;
  type: "text" | "number" | "json";
  readonly?: boolean;
  data_type: string; // Postgres data type
}

export interface TableSpec {
  id: EntityId;
  name: string;
  columns: ColumnSpec[];
}

export type SnapshotTableContext = {
  // The id of the table in the snapshot.
  id: EntityId;

  activeViewId?: string;

  // Columns that should not be considered in the context for the AI agent
  ignoredColumns: string[];

  // Columns that should be read only in the UI.
  readOnlyColumns: string[];
};

export type SnapshotColumnSettings = {
  dataConverter: string | null;
};

export interface SnapshotTable {
  id: string;
  createdAt: string;
  updatedAt: string;
  snapshotId: string;
  connectorAccountId: string | null;
  connectorDisplayName: string | null;
  connectorService: string | null;
  tableSpec: TableSpec;
  tableContext: SnapshotTableContext | null;
  columnContexts: Record<string, SnapshotColumnSettings>;
  activeRecordSqlFilter: string | null;
}

export interface Snapshot {
  id: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  connectorAccountId: string;
  tables: TableSpec[];
  tableContexts: SnapshotTableContext[];
  snapshotTables?: SnapshotTable[];
}

export interface CreateSnapshotDto {
  connectorAccountId: string;
  tableIds: EntityId[];
}

export type SnapshotRecord = {
  id: {
    wsId: string;
    remoteId: string | null;
  };
  fields: Record<string, unknown>;

  __edited_fields?: EditedFieldsMetadata;
  __dirty: boolean;
};

export type EditedFieldsMetadata = {
  /** Timestamp when the record was created locally. */
  __created?: string;
  /** Timestamp when the record was deleted locally. */
  __deleted?: string;
} & {
  /** The fields that have been edited since last download */
  [wsId: string]: string;
};


export type SnapshotTableView = {
  id: string;
  name: string;
  updatedAt: string; // ISO string, since API returns dates as strings
  recordIds: string[];
};
