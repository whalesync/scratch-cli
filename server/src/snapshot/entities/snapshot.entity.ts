import { Snapshot as PrismaSnapshot } from '@prisma/client';

export class Snapshot implements Omit<PrismaSnapshot, 'tablePaths'> {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  connectorAccountId: string;
}
