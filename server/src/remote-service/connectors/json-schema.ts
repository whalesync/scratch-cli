/**
 * Field metadata keys for connector JSON schemas
 */

// A field is readonly if the value of this key is true.
export const READONLY_FLAG = 'x-scratch-readonly';

// The native, connector-specific data type of the field.
export const CONNECTOR_DATA_TYPE = 'x-scratch-connector-data-type';

// An object describing a foreign key configuration for a field.
export const FOREIGN_KEY_OPTIONS = 'x-scratch-foreign-key';

/**
 * An object desribing a foreign key option for a field.

 */
export interface ForeignKeyOptionSchema {
  linkedTableId: string;
}
