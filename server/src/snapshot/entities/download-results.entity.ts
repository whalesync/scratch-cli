export interface DownloadSnapshotResult {
  totalRecords: number;
  tables: {
    id: string;
    name: string;
    records: number;
  }[];
}
