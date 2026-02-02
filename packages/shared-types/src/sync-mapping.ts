import { DataFolderId } from './ids';

export interface SyncMapping {
  /** Version number for future migrations */
  version: 1;

  /** Column mappings from source to destination */
  tableMappings: TableMapping[];
}

export interface TableMapping {
  sourceDataFolderId: DataFolderId;
  destinationDataFolderId: DataFolderId;

  /** Column mappings from source to destination */
  columnMappings: AnyColumnMapping[];

  /**
   * When records from source and destination
   * have the same value in these columns, they are considered the same record.
   */
  recordMatching?: {
    /** Column ID in the source DataFolder to use for matching */
    sourceColumnId: string;
    /** Column ID in the destination DataFolder to use for matching */
    destinationColumnId: string;
  };
}

export interface LocalColumnMapping {
  type: 'local';

  /** Column ID in the source DataFolder schema */
  sourceColumnId: string;

  /** Column ID in the destination DataFolder schema */
  destinationColumnId: string;
}

export interface ForeignKeyLookupColumnMapping {
  type: 'foreign_key_lookup';

  /** Column ID in the source DataFolder schema. The DataFolder schema will have the foreign key metadata.
   *  (e.g. company_id) */
  sourceColumnId: string;

  /** DataFolder that contains the details of the table referenced by this FK.
   * The DataFolder should already have this in the schema, but duplicate it here so we have all the DataFolder references.
   * (e.g. ID of a DataFolder that points to companies table) */
  referencedDataFolderId: DataFolderId;

  /** Column ID in the referenced DataFolder schema to use as the source data.
   * (e.g. display_name)
   */
  referencedColumnId: string;

  /** Column ID in the destination DataFolder schema.
   * (e.g. company_display_name)
   */
  destinationColumnId: string;
}

export type AnyColumnMapping = ColumnMappings[keyof ColumnMappings];
export interface ColumnMappings {
  LOCAL: LocalColumnMapping;
  FOREIGN_KEY_LOOKUP: ForeignKeyLookupColumnMapping;
}
