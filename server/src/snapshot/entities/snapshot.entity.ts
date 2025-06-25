import { Snapshot as PrismaSnapshot } from '@prisma/client';
import { TableSpec } from '../../remote-service/connectors/types';

export class Snapshot {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  connectorAccountId: string;

  tables: TableSpec[];

  constructor(snapshot: PrismaSnapshot) {
    this.id = snapshot.id;
    this.createdAt = snapshot.createdAt;
    this.updatedAt = snapshot.updatedAt;
    this.connectorAccountId = snapshot.connectorAccountId;
    this.tables = snapshot.tableSpecs as TableSpec[];
  }
}
