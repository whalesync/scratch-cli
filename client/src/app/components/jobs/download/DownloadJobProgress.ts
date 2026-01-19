export type TableProgress = {
  id: string;
  name: string;
  connector: string;
  records: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
  hasDirtyDiscoveredDeletes?: boolean;
};

export type FolderProgress = {
  id: string;
  name: string;
  connector: string;
  files: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
  hasDirtyDiscoveredDeletes?: boolean;
};

// Download records progress (existing)
export type DownloadRecordsProgress = {
  totalRecords: number;
  tables: TableProgress[];
};

// Download files progress (new)
export type DownloadFilesProgress = {
  totalFiles: number;
  folders: FolderProgress[];
};

// Combined type that can be either
export type DownloadProgress = DownloadRecordsProgress | DownloadFilesProgress;

// Type guard to check which type of progress we have
export function isDownloadFilesProgress(progress: DownloadProgress): progress is DownloadFilesProgress {
  return 'folders' in progress;
}
