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
 * @deprecated - use SnapshotTableColumnContexts instead
 */
export type SnapshotColumnContexts = {
  [tableId: string]: SnapshotColumnSettingsMap;
};

/** Extra settings for columns in a table, mapped by column WS id. */
export type SnapshotColumnSettingsMap = { [columnWsId: string]: SnapshotColumnSettings };

/**
 * Maps tableId to an SQL WHERE clause that filters records.
 */
export type ActiveRecordSqlFilter = {
  [tableId: string]: string;
};
