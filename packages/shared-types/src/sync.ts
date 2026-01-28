export interface SyncMapping {
  /** Version number for future migrations */
  version: 1;

  /** Column mappings from source to destination */
  columnMappings: ColumnMapping[];

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

export interface ColumnMapping {
  /** Column ID in the source DataFolder schema */
  sourceColumnId: string;

  /** Column ID in the destination DataFolder schema */
  destinationColumnId: string;
}
