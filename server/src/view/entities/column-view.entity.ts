import { ColumnView as PrismaColumnView } from '@prisma/client';
import { ViewConfig } from '../types';

export class ColumnView {
  id: string;
  name: string | null;
  snapshotId: string;
  config: ViewConfig;
  createdAt: Date;
  updatedAt: Date;

  constructor(columnView: PrismaColumnView) {
    this.id = columnView.id;
    this.name = columnView.name;
    this.snapshotId = columnView.snapshotId;
    this.config = columnView.config as ViewConfig;
    this.createdAt = columnView.createdAt;
    this.updatedAt = columnView.updatedAt;
  }
}
