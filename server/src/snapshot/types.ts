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
 * Persitant configuration for columns within a snapshot that is shared in the UI and the connectors.
 * Defines columns extra settings, e.g. Notion data converter HTML/Markdown, Custom converter..
 */
export type SnapshotColumnSettings = {
  /**
   * Settings for custom data converters, we can also define default converters and users can choose from them.
   * for custom converters, we can save the python code.
   * @example "html" | "markdown" | etc.
   */
  dataConverter: string | null;
};

/**
 * Snapshot column contexts are extra settings for columns mapped from Table id to column id.
 */
export type SnapshotColumnContexts = {
  [tableId: string]: {
    [columnId: string]: SnapshotColumnSettings;
  };
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
