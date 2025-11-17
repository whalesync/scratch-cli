import { EditedFieldsMetadata } from 'src/snapshot/snapshot-db';
import { SnapshotRecordId } from '../../types/ids';

export type TablePreview = {
  id: EntityId;
  displayName: string;
  metadata?: Record<string, unknown>;
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

export type BaseTableSpec<ColumnType extends BaseColumnSpec> = {
  id: EntityId;
  /**
   * Connector suggested, pg-table-name compatible identifier of the table.
   * This was pereviously confusingly called wsId.
   * The reason for the cconfussion is that for records the wsId is actually generated
   * by the core code, not the connector, but for tables it is the opposite.
   * This field is probably not necessery - we can use sanitized(name) as the slug,
   * however it is also possible that connectors, having better knowledge of the table name
   * conventions of the service, will be better at generating slugs.
   * This field is currently just set parallel to the wsId but not used.
   * We will start using it after the migration that drops
   */
  slug: string;
  name: string;
  columns: ColumnType[];
  // The remoteId of the column that should be used as the title/header column for visualizing records
  titleColumnRemoteId?: EntityId['remoteId'];
};

/** Types of columns we support. Add more if needed. */
export enum PostgresColumnType {
  TEXT = 'text',
  TEXT_ARRAY = 'text[]',
  NUMERIC = 'numeric',
  NUMERIC_ARRAY = 'numeric[]',
  BOOLEAN = 'boolean',
  BOOLEAN_ARRAY = 'boolean[]',
  JSONB = 'jsonb',
  TIMESTAMP = 'timestamp',
}
/** This is being passed to the agent as a string.
 * make sure we don't add any actionable properties here.
 * e.g. writeable: true would make the agent belive that the column is writable.
 */
export type ColumnMetadata = {
  // Defintes the flavor of the text in the column and influences how it is displayed in the UI.
  textFormat?: 'markdown' | 'html' | 'url' | 'email' | 'phone' | 'csv' | 'rich_text' | 'long_text';
  dateFormat?: 'date' | 'datetime' | 'time';
  numberFormat?: 'decimal' | 'integer';
  options?: ColumnOptions[];
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

export type ColumnOptions = {
  value?: string;
  label?: string;
};

export type BaseColumnSpec = {
  id: EntityId;
  name: string;

  pgType: PostgresColumnType;
  /** @deprecated
   * This is deprecated and replaced with options inside the column metadata.
   * it's only used by youtube.
   */
  limitedToValues?: string[];
  required?: boolean;
  readonly?: boolean;

  metadata?: ColumnMetadata;
  /**
   * Types of data converters that are supported for this column.
   * @example ["html", "markdown"]
   */
  dataConverterTypes?: string[];
};

/**
 * A record from the connector.
 * Everything uses connector IDs.
 */
export type ConnectorRecord = {
  // Remote ID from the connector.
  id: string;
  // Columns, indexed by the wsId NOT the connector's native ID.
  fields: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type SnapshotRecord = {
  id: {
    // Internal ID for the record.
    wsId: SnapshotRecordId;
    // Remote ID from the connector.
    // Can be null if the record is new.
    remoteId: string | null;
  };

  // Columns, indexed by the wsId NOT the connector's native ID.
  fields: Record<string, unknown>;

  __edited_fields: EditedFieldsMetadata;
  __suggested_values: Record<string, unknown>;
  __dirty: boolean;
  __metadata: Record<string, unknown>;
};

export type ExistingSnapshotRecord = SnapshotRecord & {
  id: {
    remoteId: string;
  };
};

export type SnapshotRecordSanitizedForUpdate = {
  id: {
    // Internal ID for the record.
    wsId: SnapshotRecordId;
    // Remote ID from the connector.
    // Can be null if the record is new.
    remoteId: string;
  };

  // Columns, indexed by the wsId NOT the connector's native ID.
  partialFields: Record<string, unknown>;
};

export type CreateRecordInput = {
  wsId: SnapshotRecordId;
  fields: Record<string, unknown>;
};

export type UpdateRecordInput = {
  wsId: SnapshotRecordId;
  id: string;
  fields: Record<string, unknown>;
};

export type DeleteRecordInput = {
  wsId: SnapshotRecordId;
  id: string;
};

export type ConnectorErrorDetails = {
  userFriendlyMessage: string;
  description?: string;
  additionalContext?: Record<string, unknown>;
};
