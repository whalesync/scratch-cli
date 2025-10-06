export type DownloadProgress = {
    totalRecords: number;
    tables: TableProgress[];
  };

export type TableProgress = {
    id: string;
    name: string;
    records: number;
    status: 'pending' | 'active' | 'completed' | 'failed';
};
  
  