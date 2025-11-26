export type DownloadProgress = {
  totalRecords: number;
  tables: TableProgress[];
};

export type TableProgress = {
  id: string;
  name: string;
  connector: string;
  records: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
};
