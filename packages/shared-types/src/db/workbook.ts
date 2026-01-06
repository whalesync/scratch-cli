import { WorkbookId } from '../ids';
import { Folder } from './folder';
import { SnapshotTable } from './snapshot-table';

///
/// NOTE: Keep this in sync with server/prisma/schema.prisma Workbook model
/// Begin "keep in sync" section
///

export interface Workbook {
  id: WorkbookId;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  snapshotTables?: SnapshotTable[];
  folders?: Folder[];
  userId: string;
}

///
/// End "keep in sync" section
///
