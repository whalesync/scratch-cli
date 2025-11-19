export type PublishRecordsPublicProgress = {
  totalRecordsPublished: number;
  tables: {
    id: string;
    name: string;
    creates: number;
    updates: number;
    deletes: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  }[];
};
