import { Snapshot as PrismaSnapshot } from '@prisma/client';

export class Snapshot implements Omit<PrismaSnapshot, 'tableSpecs'> {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  connectorAccountId: string;
}
