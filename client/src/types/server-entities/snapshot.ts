import { EntityId } from "./table-list";

export interface ColumnSpec {
  id: EntityId;
  name: string;
  type: "text" | "number" | "json";
  readonly?: boolean;
  pgType: PostgresColumnType;
}

export enum PostgresColumnType {
  TEXT = "text",
  TEXT_ARRAY = "text[]",
  NUMERIC = "numeric",
  NUMERIC_ARRAY = "numeric[]",
  BOOLEAN = "boolean",
  BOOLEAN_ARRAY = "boolean[]",
  JSONB = "jsonb",
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
  connectorDisplayName: string | null;
  connectorService: string | null;
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

export type ActivateViewDto = {
  source: 'ui' | 'agent';
  recordIds: string[];
};
