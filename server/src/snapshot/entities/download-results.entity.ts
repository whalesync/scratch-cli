export interface DownloadSnapshotWithouotJobResult {
  totalRecords: number;
  tables: {
    id: string;
    name: string;
    records: number;
  }[];
}

export interface DownloadSnapshotResult {
  jobId: string;
}
