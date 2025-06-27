import { EditedFieldsMetadata } from '../../snapshot/snapshot-db.service';
import { SnapshotRecordId } from '../../types/ids';

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

export type BaseTableSpec<ColumnType extends BaseColumnSpec> = {
  id: EntityId;
  name: string;
  columns: ColumnType[];
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
}

export type BaseColumnSpec = {
  id: EntityId;
  name: string;

  pgType: PostgresColumnType;
  readonly?: boolean;
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
  __dirty: boolean;
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
