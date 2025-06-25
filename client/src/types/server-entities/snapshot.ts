import { EntityId } from "./table-list";

export interface ColumnSpec {
  id: EntityId;
  name: string;
  type: "text" | "number" | "json";
}

export interface TableSpec {
  id: EntityId;
  name: string;
  columns: ColumnSpec[];
}

export interface Snapshot {
  id: string;
  createdAt: string;
  updatedAt: string;
  connectorAccountId: string;
  tables: TableSpec[];
}

export interface CreateSnapshotDto {
  connectorAccountId: string;
  tableIds: EntityId[];
}

export type SnapshotRecord = {
  /** RemoteID, which we also use as the primary key. */
  id: string;

  /** Which fields are dirty in the local copy of the record. */
  __edited_fields?: EditedFieldsMetadata;
} & {
  /** The actual data */
  [wsId: string]: unknown;
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
