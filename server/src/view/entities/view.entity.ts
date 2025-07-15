import { View as PrismaView } from '@prisma/client';
import { ViewConfig } from '../types';

export class View {
  id: string;
  parentId: string | null;
  name: string | null;
  snapshotId: string;
  config: ViewConfig;
  createdAt: Date;
  updatedAt: Date;

  constructor(view: PrismaView) {
    this.id = view.id;
    this.parentId = view.parentId;
    this.name = view.name;
    this.snapshotId = view.snapshotId;
    this.config = view.config as ViewConfig;
    this.createdAt = view.createdAt;
    this.updatedAt = view.updatedAt;
  }
}
