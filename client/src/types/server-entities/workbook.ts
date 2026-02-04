import { isNotEmpty } from '@/utils/helpers';
import {
  ColumnSpec,
  PostgresColumnType,
  Service,
  SnapshotColumnSettingsMap,
  SnapshotTable,
  TableSpec,
  Workbook,
} from '@spinner/shared-types';
import isBoolean from 'lodash/isBoolean';
import isNumber from 'lodash/isNumber';
import partition from 'lodash/partition';
import toNumber from 'lodash/toNumber';
import truncate from 'lodash/truncate';
import uniq from 'lodash/uniq';

export interface UpdateColumnSettingsDto {
  /** Only keys present in the map will be updated, other keys will be left unchanged. */
  columnSettings: SnapshotColumnSettingsMap;
}

export type SnapshotRecord = {
  id: {
    wsId: string;
    remoteId: string | null;
  };
  fields: Record<string, unknown>;

  __edited_fields?: EditedFieldsMetadata;
  __suggested_values?: Record<string, unknown>;
  __fields?: Record<string, unknown>;
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

export interface PullWorkbookResult {
  jobId: string;
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
        const value = truncate(record.fields[key] as string, { length: 25 });
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

export function getConnectorsWithStatus(workbook: Workbook): { connectorService: Service; isBroken: boolean }[] {
  // Collect connector info from both snapshotTables and dataFolders
  const connectorSources = [
    ...(workbook.snapshotTables ?? []).map((table) => ({
      connectorService: table.connectorService,
      connectorAccountId: table.connectorAccountId,
    })),
    ...(workbook.dataFolders ?? []).map((folder) => ({
      connectorService: folder.connectorService,
      connectorAccountId: folder.connectorAccountId,
    })),
  ];

  const [working, broken] = partition(
    connectorSources,
    (source) => source.connectorService === Service.CSV || source.connectorAccountId !== null,
  );

  // Get rid of nulls
  let workingServices = working.map((source) => source.connectorService).filter(isNotEmpty);
  let brokenServices = broken.map((source) => source.connectorService).filter(isNotEmpty);
  // Make each unique.
  workingServices = uniq(workingServices);
  brokenServices = uniq(brokenServices);

  return [
    ...workingServices.map((connectorService) => ({ connectorService, isBroken: false })),
    ...brokenServices.map((connectorService) => ({ connectorService, isBroken: true })),
  ];
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
