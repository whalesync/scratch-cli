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

// Pull records progress (existing)
export type PullRecordsProgress = {
  totalRecords: number;
  tables: TableProgress[];
};

// Pull files progress (new)
export type PullFilesProgress = {
  totalFiles: number;
  folders: FolderProgress[];
};

// Combined type that can be either
export type PullProgress = PullRecordsProgress | PullFilesProgress;

// Type guard to check which type of progress we have
export function isPullFilesProgress(progress: PullProgress): progress is PullFilesProgress {
  return 'folders' in progress;
}
