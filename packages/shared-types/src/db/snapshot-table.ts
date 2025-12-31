import { Service, SnapshotTableId, WorkbookId } from '../';
import { EntityId, PostgresColumnType } from '../connector-types';
import { SnapshotColumnSettingsMap } from '../workbook-types';

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

export interface TableSpec {
  id: EntityId;
  name: string;
  columns: ColumnSpec[];
  // The remoteId of the column that should be used as the title/header column for visualizing records
  titleColumnRemoteId?: string[];
  // The remoteId of the column that should be used as the main content/body in MD view
  mainContentColumnRemoteId?: string[];
}

///
/// NOTE: Keep this in sync with server/prisma/schema.prisma SnapshotTable model
/// Begin "keep in sync" section
///

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
  path: string | null;
}

///
/// End "keep in sync" section
///
