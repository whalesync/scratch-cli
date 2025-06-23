import { Snapshot as PrismaSnapshot } from '@prisma/client';

export class Snapshot implements PrismaSnapshot {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  connectorAccountId: string;
}
