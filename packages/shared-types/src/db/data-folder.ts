import { Service } from '../enums/enums';
import { DataFolderId, WorkbookId } from '../ids';

///
/// NOTE: Keep this in sync with server/prisma/schema.prisma DataFolder model
/// Begin "keep in sync" section
///

export interface DataFolder {
  id: DataFolderId;
  createdAt: string;
  updatedAt: string;
  name: string;
  workbookId: WorkbookId;
  connectorAccountId: string | null;
  connectorDisplayName: string | null;
  connectorService: Service | null;
  schema: Record<string, unknown> | null;
  lastSchemaRefreshAt: string | null;
  parentId: string | null;
  path: string | null;
  lock: string | null;
  lastSyncTime: string | null;
  version: number;
  tableId: string[];
}

///
/// End "keep in sync" section
///

export interface DataFolderGroup {
  name: string;
  service: Service | null;
  dataFolders: DataFolder[];
}
