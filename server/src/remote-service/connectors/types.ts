import { TSchema } from '@sinclair/typebox';
import type { EntityId } from '@spinner/shared-types';
import { PostgresColumnType, SnapshotRecordId } from '@spinner/shared-types';
import { EditedFieldsMetadata } from 'src/workbook/snapshot-db';

// Re-export from shared-types for backwards compatibility
export { PostgresColumnType };
export type { EntityId };

export type TablePreview = {
  id: EntityId;
  displayName: string;
  metadata?: Record<string, unknown>;
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
  // The remoteId of the column that should be used as the main content/body in MD view
  mainContentColumnRemoteId?: EntityId['remoteId'];
};

export type BaseJsonTableSpec = {
  id: EntityId;
  slug: string;
  name: string;
  schema: TSchema;
  // The remoteId of the column that should be used as the id column for visualizing records
  // This is used to identify the record in the connector.
  // This is usually the id column, but it can be different for some connectors id vs Id, etc.
  idColumnRemoteId: string;
  // The remoteId of the column that should be used as the title/header column for visualizing records
  titleColumnRemoteId?: EntityId['remoteId'];
  // The remoteId of the column that should be used as the main content/body in MD view
  // This is used to display the main content of the record in the MD view.
  mainContentColumnRemoteId?: EntityId['remoteId'];
};

/** This is being passed to the agent as a string.
 * make sure we don't add any actionable properties here.
 * e.g. writeable: true would make the agent belive that the column is writable.
 */
export type ColumnMetadata = {
  // Defintes the flavor of the text in the column and influences how it is displayed in the UI and how it is processed by the agent.
  textFormat?: 'markdown' | 'html' | 'url' | 'email' | 'phone' | 'csv' | 'rich_text';

  // Defines how the date is formatted and displayed in the UI and how it is processed by the agent.
  dateFormat?: 'date' | 'datetime' | 'time';

  // Defines how the number is formatted and displayed in the UI and how it is processed by the agent.
  numberFormat?: 'decimal' | 'integer';

  // Defines a list of options that are permitted values for the column
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

  /**
   * If the column is an attachment column, this defines the type of the attachments.
   */
  attachments?: 'single' | 'multiple';
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

  /**
   * A unique, slugified version of the column name
   * Implementation depends on the connector but can be used to identify the column in the UI and in the agent.
   */
  slug?: string;
};

/**
 * This is a placeholder type for the new ScratchSync JSON file format
 */
export type ConnectorFile = Record<string, unknown>;

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

  /** Any errors or warning to associate with the record the user. */
  errors?: RecordErrorsMetadata;
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

  // Per field meta information.
  __edited_fields: EditedFieldsMetadata;
  __suggested_values: Record<string, unknown>;
  __fields: Record<string, unknown>;
  __metadata: Record<string, unknown>;
  __errors: RecordErrorsMetadata;

  // Per record meta information.
  __dirty: boolean;
  __old_remote_id: string | null;
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

export type RecordErrorsMetadata = {
  // TODO: Add record-level here if needed.

  /** Indexed by the WSID of the field */
  byField?: Record<string, { message: string; severity: 'warning' | 'error' }[]>;
};

// ============================================================================
// File Validation Types
// ============================================================================

export type FileValidationInput = {
  filename: string;
  id?: string;
  data: Record<string, unknown>;
};

export type FileValidationResult = {
  filename: string;
  id?: string;
  data: Record<string, unknown>;
  publishable: boolean;
  errors?: string[];
};

export type FieldValidationContext = {
  fieldKey: string;
  fieldName: string;
  value: unknown;
  pgType: PostgresColumnType;
  metadata?: ColumnMetadata;
};

/**
 * Options to customize validation behavior for different connectors.
 * Allows connectors to override specific type validations or add custom logic.
 */
export type FileValidatorOptions = {
  /**
   * Fields that should be ignored during validation (e.g., internal metadata fields).
   * These fields won't trigger "unknown field" errors and won't be type-checked.
   */
  ignoredFields?: Set<string>;

  /**
   * Custom type validators that override or extend the default validation.
   * Return undefined to fall back to default validation.
   * Return null to skip validation for this field entirely.
   * Return a string to report an error.
   */
  customTypeValidators?: {
    [K in PostgresColumnType]?: (ctx: FieldValidationContext) => string | null | undefined;
  };

  /**
   * Additional validation to run after type validation.
   * Useful for connector-specific business rules.
   */
  additionalValidators?: Array<(ctx: FieldValidationContext) => string | undefined>;
};
