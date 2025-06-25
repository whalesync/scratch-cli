export type TablePreview = {
  id: EntityId;
  displayName: string;
};

/** ID for a table or column. It contains both our internal postgres ID and whatever path info the connector needs. */
export type EntityId = {
  /**
   * The id for whalesync to use for this table.
   * This must be a valid and easy to use identifier in postgres.
   * It should be human readable and friendly.
   * Consider putting the
   */
  wsId: string;

  /**
   * The id for the table in the connector.
   * It is an array so the connector can use it as a path.
   */
  remoteId: string[];
};

export type TableSpec = {
  id: EntityId;
  name: string;

  // TODO custom connectordata.

  columns: ColumnSpec[];
};

export type ColumnSpec = {
  id: EntityId;
  name: string;
  type: 'text' | 'number' | 'json';

  // TODO custom connectordata.
};

/**
 * A record from the connector.
 * NOTE THE REQUIREMENTS:
 * 1. Must have a string `id` field.
 * 2. All other fields are indexed by the WHALESYNC ID, not the native one.
 *
 * TODO(ryder): I'm not sure about requirement #2. I would prefer a way for connectors to dump the rawest possible
 * records and be able to convert it to a usable postgres record later on, but that conversion is connector specific,
 * so for now lets just make the getrecord call handle it, i think.
 */
export type ConnectorRecord = { id: string; [wsId: string]: unknown };
