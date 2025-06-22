import { Snapshot as PrismaSnapshot, SnapshotStatus } from '@prisma/client';

export class Snapshot implements PrismaSnapshot {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  status: SnapshotStatus;
  connectorAccountId: string;
}
