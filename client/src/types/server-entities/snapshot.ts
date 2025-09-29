import _ from "lodash";
import { EntityId } from "./table-list";

export interface ColumnSpec {
  id: EntityId;
  name: string;
  readonly?: boolean;
  pgType: PostgresColumnType;
  markdown?: boolean;
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

export type SnapshotTableContext = {
  // The id of the table in the snapshot.
  id: EntityId;

  activeViewId?: string;

  // Columns that should not be considered in the context for the AI agent
  ignoredColumns: string[];

  // Columns that should be read only in the UI.
  readOnlyColumns: string[];
};

export interface Snapshot {
  id: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  connectorAccountId: string;
  tables: TableSpec[];
  connectorDisplayName: string | null;
  connectorService: string | null;
  tableContexts: SnapshotTableContext[];
  activeRecordSqlFilter?: Record<string, string>;
}

export interface CreateSnapshotDto {
  connectorAccountId: string;
  name: string;
  tableIds: EntityId[];
}

export interface UpdateSnapshotDto {
  name?: string;
}

export interface AcceptCellValueItem {
  wsId: string;
  columnId: string;
}

export interface AcceptCellValueDto {
  items: AcceptCellValueItem[];
}

export type SnapshotRecord = {
  id: {
    wsId: string;
    remoteId: string | null;
  };
  fields: Record<string, unknown>;

  __edited_fields?: EditedFieldsMetadata;
  __suggested_values?: Record<string, unknown>;
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

export interface DownloadSnapshotResult {
  totalRecords: number;
  tables: {
    id: string;
    name: string;
    records: number;
  }[];
}

export interface AcceptAllSuggestionsResult {
  recordsUpdated: number;
  totalChangesAccepted: number;
}


export interface RejectAllSuggestionsResult {
  recordsRejected: number;
  totalChangesRejected: number;
}

export function isTextColumn(column: ColumnSpec) {
  return column.pgType === PostgresColumnType.JSONB || column.pgType === PostgresColumnType.TEXT;
}

export function isLargeTextColumn(column: ColumnSpec, value: string | undefined | null) {
  return column.markdown || column.pgType === PostgresColumnType.JSONB || (column.pgType === PostgresColumnType.TEXT && value && value.length > 100);
}

export function isUrlColumn(column: ColumnSpec, value: string | undefined | null): boolean {
  if(column.pgType === PostgresColumnType.TEXT && column.name.toLowerCase().includes('url') && value) {
    try {
      new URL(value);
      return true;
    } catch (error) {
      console.debug('Failed to parse URL:', error);
      return false;
    }
  }

  return false;
}

export function formatFieldValue(value: unknown, column: ColumnSpec): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (column.pgType === PostgresColumnType.JSONB) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      console.warn('Failed to stringify JSONB value:', error);
      return String(value);
    }
  }
  
  return String(value);
}

export function buildRecordTitle(record: SnapshotRecord): string {

  if (record.fields) {
    for (const key of Object.keys(record.fields)) {
      if (key.toLowerCase() === 'title' || key.toLowerCase() === 'name') {
        const value = _.truncate(record.fields[key] as string, { length: 40 });
        if (value) {
          return value;
        }
      }
    }
    const firstValue = Object.values(record.fields)[0];
    if (firstValue) {
      return _.truncate(firstValue as string, { length: 40 });
    }
  }
  return record.id.wsId;
}

export function getSafeBooleanValue(fields: Record<string, unknown>, columnId: string): boolean {
  const value = fields[columnId];
  if (value === null || value === undefined) {
    return false;
  }

  if (_.isBoolean(value)) {
    return value as boolean;
  }

  return new Boolean(value).valueOf();
}

export function getSafeNumberValue(fields: Record<string, unknown>, columnId: string, defaultValue?: number): number | undefined {
  const value = fields[columnId];
  if (value === null || value === undefined) {
    return defaultValue ?? undefined;
  }

  if (_.isNumber(value)) {
    return value as number;
  }

  return _.toNumber(value);
}