export type TableStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'canceled';

export type PublishRecordsPublicProgress = {
  totalRecordsPublished: number;
  tables: {
    id: string;
    name: string;
    connector: string;
    creates: number;
    updates: number;
    deletes: number;
    expectedCreates: number;
    expectedUpdates: number;
    expectedDeletes: number;
    status: TableStatus;
  }[];
};
