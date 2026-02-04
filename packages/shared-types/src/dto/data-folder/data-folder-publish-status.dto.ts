import type { Service } from '../../enums/enums';
import type { DataFolderId } from '../../ids';

/**
 * Status information for a data folder regarding publishing.
 * Used by the multi-data-folder publish modal to show which folders have changes.
 */
export interface DataFolderPublishStatus {
  folderId: DataFolderId;
  folderName: string;
  connectorService: Service | null;
  connectorDisplayName: string | null;
  lock: string | null;
  creates: number;
  updates: number;
  deletes: number;
  hasChanges: boolean;
}
