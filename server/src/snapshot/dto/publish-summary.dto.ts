export interface PublishSummaryDto {
  /** Records that will be deleted, showing title only */
  deletes: {
    tableId: string;
    tableName: string;
    records: {
      wsId: string;
      title: string;
    }[];
  }[];

  /** Records that will be updated, showing changes keyed by record id */
  updates: {
    tableId: string;
    tableName: string;
    records: {
      wsId: string;
      title: string;
      changes: Record<string, { from: unknown; to: unknown }>;
    }[];
  }[];

  /** Count of records that will be created */
  creates: {
    tableId: string;
    tableName: string;
    count: number;
  }[];
}
