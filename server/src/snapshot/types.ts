import { EntityId } from 'src/remote-service/connectors/types';

/**
 * Persitant configuration for a table within a snapshot that is shared between the UI and the AI agent.
 * Defines how the table can be used in the context and how it should be displayed.
 */
export type SnapshotTableContext = {
  // The id of the table in the snapshot.
  id: EntityId;

  activeViewId: string | null;

  // Columns that should not be considered in the context for the AI agent
  ignoredColumns: string[];

  // Columns that should be read only in the UI.
  readOnlyColumns: string[];
};

/**
 * Maps tableId to an array of record IDs that are currently visible (filtered in).
 */
export type ActiveRecordFilter = {
  [tableId: string]: string[];
};

/**
 * Maps tableId to an SQL WHERE clause that filters records.
 */
export type ActiveRecordSqlFilter = {
  [tableId: string]: string;
};
