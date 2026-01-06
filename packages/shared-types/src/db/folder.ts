import { FolderId, WorkbookId } from '../ids';
import { SnapshotTable } from './snapshot-table';
import { Workbook } from './workbook';

///
/// NOTE: Keep this in sync with server/prisma/schema.prisma Folder model
/// Begin "keep in sync" section
///

export interface Folder {
  id: FolderId;
  createdAt: string;
  updatedAt: string;

  name: string;

  workbookId: WorkbookId;
  workbook?: Workbook;

  parentId: FolderId | null;
  parent?: Folder;
  children?: Folder[];

  snapshotTables?: SnapshotTable[];
}

///
/// End "keep in sync" section
///
