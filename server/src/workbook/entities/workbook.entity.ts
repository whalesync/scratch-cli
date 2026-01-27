import { WorkbookId } from '@spinner/shared-types';
import { WorkbookCluster } from '../../db/cluster-types';
import { DataFolderEntity } from './data-folder.entity';
import { SnapshotTable as SnapshotTableEntity } from './snapshot-table.entity';

export class Workbook {
  id: WorkbookId;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string | null;
  organizationId: string;

  snapshotTables?: SnapshotTableEntity[];
  dataFolders?: DataFolderEntity[];

  constructor(workbook: WorkbookCluster.Workbook) {
    this.id = workbook.id as WorkbookId;
    this.name = workbook.name ?? null;
    this.createdAt = workbook.createdAt;
    this.updatedAt = workbook.updatedAt;
    this.userId = workbook.userId ?? null;
    this.organizationId = workbook.organizationId;
    this.snapshotTables = workbook.snapshotTables?.map((st) => new SnapshotTableEntity(st));
    this.dataFolders = workbook.dataFolders?.map((df) => new DataFolderEntity(df));
  }
}
