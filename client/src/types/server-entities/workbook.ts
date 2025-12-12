import { Service, SnapshotTableId, WorkbookId } from '@spinner/shared-types';
import isBoolean from 'lodash/isBoolean';
import isNumber from 'lodash/isNumber';
import toNumber from 'lodash/toNumber';
import truncate from 'lodash/truncate';
import { EntityId } from './table-list';

export type ColumnMetadata = {
  textFormat?: 'markdown' | 'html' | 'url' | 'email' | 'phone' | 'csv' | 'rich_text';
  dateFormat?: 'date' | 'datetime' | 'time';
  numberFormat?: 'decimal' | 'integer';
  options?: ColumnOption[];
  /**
   * If true, any value is allowed for the column.
   * otherwise the column must follow the option values.
   */
  allowAnyOption?: boolean;
  /**
   * If true, the column is a scratch column.
   * scratch columns are not saved to the connector and are only internally by the UI and the agents.
   */
  scratch?: boolean;
};

export type ColumnOption = {
  value?: string;
  label?: string;
};

export interface ColumnSpec {
  id: EntityId;
  name: string;
  readonly?: boolean;
  required?: boolean;
  pgType: PostgresColumnType;
  metadata?: ColumnMetadata;
  dataConverterTypes?: string[];
}

export enum PostgresColumnType {
  TEXT = 'text',
  NUMERIC = 'numeric',
  BOOLEAN = 'boolean',
  JSONB = 'jsonb',
  TEXT_ARRAY = 'text[]',
  NUMERIC_ARRAY = 'numeric[]',
  BOOLEAN_ARRAY = 'boolean[]',
  TIMESTAMP = 'timestamp',
}

export interface TableSpec {
  id: EntityId;
  name: string;
  columns: ColumnSpec[];
  // The remoteId of the column that should be used as the title/header column for visualizing records
  titleColumnRemoteId?: string[];
}

export type SnapshotColumnSettings = {
  dataConverter: string | null;
};

export type SnapshotColumnSettingsMap = { [columnWsId: string]: SnapshotColumnSettings };

export interface SnapshotTable {
  id: SnapshotTableId;
  createdAt: string;
  updatedAt: string;
  workbookId: WorkbookId;
  connectorAccountId: string | null;
  connectorDisplayName: string | null;
  connectorService: Service | null;
  tableSpec: TableSpec;
  columnSettings: SnapshotColumnSettingsMap;
  activeRecordSqlFilter: string | null;
  pageSize: number | null;
  hidden: boolean;
  lock: string | null;
  hiddenColumns: string[];
  lastSyncTime: string | null;
  dirty: boolean;
}

export interface Workbook {
  id: WorkbookId;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  snapshotTables?: SnapshotTable[];
  userId: string;
}

export interface CreateWorkbookDto {
  name?: string;
  tables?: {
    connectorAccountId: string;
    tableId: EntityId;
  }[];
}

export interface AddTableToWorkbookDto {
  service: Service;
  connectorAccountId?: string;
  tableId: EntityId;
}

export interface UpdateWorkbookDto {
  name?: string;
}

export interface UpdateColumnSettingsDto {
  /** Only keys present in the map will be updated, other keys will be left unchanged. */
  columnSettings: SnapshotColumnSettingsMap;
}

export interface AddScratchColumnDto {
  columnName: string;
  dataType: PostgresColumnType;
}

export interface RemoveScratchColumnDto {
  columnId: string;
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
  __errors: RecordErrorsMetadata;
};

export const SNAPSHOT_RECORD_DELETED_FIELD = '__deleted';
export const SNAPSHOT_RECORD_CREATED_FIELD = '__created';

export type EditedFieldsMetadata = {
  /** Timestamp when the record was created locally. */
  __created?: string;
  /** Timestamp when the record was deleted locally. */
  __deleted?: string;
} & {
  /** The fields that have been edited since last download */
  [wsId: string]: string;
};

export type RecordErrorsMetadata = {
  byField?: Record<string, { message: string; severity: 'warning' | 'error' }[]>;
};

export interface DownloadWorkbookWithoutJobResult {
  totalRecords: number;
  tables: {
    id: string;
    name: string;
    records: number;
  }[];
}

export interface DownloadWorkbookResult {
  jobId: string;
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
  return (
    column.metadata?.textFormat === 'markdown' ||
    column.metadata?.textFormat === 'rich_text' ||
    column.pgType === PostgresColumnType.JSONB ||
    (column.pgType === PostgresColumnType.TEXT && value && value.length > 100)
  );
}

export function isUrlColumn(column: ColumnSpec, value: string | undefined | null): boolean {
  if (column.pgType === PostgresColumnType.TEXT && column.name.toLowerCase().includes('url') && value) {
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

  if (column.pgType === PostgresColumnType.JSONB || column.pgType === PostgresColumnType.TEXT_ARRAY) {
    // if it's a string most likely it's already a stringified JSON object, so we return it as is.
    if (typeof value === 'string') {
      return value;
    }
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
        const value = truncate(record.fields[key] as string, { length: 40 });
        if (value) {
          return value;
        }
      }
    }
    const firstValue = Object.values(record.fields)[0];
    if (firstValue) {
      return truncate(firstValue as string, { length: 40 });
    }
  }
  return record.id.wsId;
}

export function getSafeBooleanValue(fields: Record<string, unknown>, columnId: string): boolean {
  const value = fields[columnId];
  if (value === null || value === undefined) {
    return false;
  }

  if (isBoolean(value)) {
    return value as boolean;
  }

  return new Boolean(value).valueOf();
}

export function getSafeNumberValue(
  fields: Record<string, unknown>,
  columnId: string,
  defaultValue?: number,
): number | undefined {
  const value = fields[columnId];
  if (value === null || value === undefined || value === '') {
    return defaultValue ?? undefined;
  }

  if (isNumber(value)) {
    return value as number;
  }

  return toNumber(value);
}

// ------------------------------------------------------------
export function getSnapshotTableById(workbook: Workbook, tableId: string): SnapshotTable | undefined {
  return workbook.snapshotTables?.find((t) => t.id === tableId);
}

export function getTableSpecById(workbook: Workbook, tableId: string): TableSpec | undefined {
  const table = getSnapshotTableById(workbook, tableId);
  return table?.tableSpec;
}

export function getActiveRecordSqlFilterById(workbook: Workbook, tableId: string): string | undefined {
  const table = getSnapshotTableById(workbook, tableId);
  return table && table.activeRecordSqlFilter ? table.activeRecordSqlFilter : undefined;
}

/**
 * Checks if all connections in a workbook are deleted.
 * Returns true if:
 * - The workbook has at least one snapshot table with a connector account
 * - All snapshot tables with connector accounts have a deleted connection.
 * Returns false otherwise.
 */
export function hasAllConnectionsDeleted(workbook: Workbook | undefined): boolean {
  if (!workbook) {
    return false;
  }
  if (workbook.snapshotTables?.length === 0) {
    return false;
  }
  // Check if all tables have a deleted connection
  return (
    workbook.snapshotTables?.every((table) => {
      // CSV tables can't have a deleted connection, so we return false
      if (table.connectorService === Service.CSV) {
        return false;
      }
      return table.connectorAccountId === null && table.connectorService !== null;
    }) ?? false
  );
}

/**
 * Checks if a service is deleted in a workbook.
 * Returns true if:
 * - The workbook has at least one snapshot table with the given service
 * - All snapshot tables with the given service have a deleted connection.
 * Returns false otherwise.
 */
export function hasDeletedServiceConnection(workbook: Workbook | undefined, service: Service): boolean {
  if (!workbook) {
    return false;
  }
  return (
    workbook.snapshotTables
      ?.filter((table) => table.connectorService === service)
      .every((table) => hasDeletedConnection(table)) ?? false
  );
}

/**
 * Checks if a snapshot table has a connection deleted.
 * A deleted connection is when the connector account was removed but the table still exists.
 * This is indicated by connectorAccountId being null while connectorService is not null.
 */
export function hasDeletedConnection(table: SnapshotTable): boolean {
  // CSV tables can't have a deleted connection, so we return false
  if (table.connectorService === Service.CSV) {
    return false;
  }
  return table.connectorAccountId === null && table.connectorService !== null;
}
