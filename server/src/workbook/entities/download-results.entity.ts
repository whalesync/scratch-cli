export interface DownloadWorkbookWithoutJobResult {
  totalRecords: number;
  tables: {
    id: string;
    name: string;
    records: number;
  }[];
}

export interface DownloadWorkbookResult {
  jobId: string;
}
