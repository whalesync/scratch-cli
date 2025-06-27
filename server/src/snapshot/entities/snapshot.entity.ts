import { Snapshot as PrismaSnapshot } from '@prisma/client';
import { AnyTableSpec } from '../../remote-service/connectors/library/custom-spec-registry';

export class Snapshot {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  connectorAccountId: string;

  tables: AnyTableSpec[];

  constructor(snapshot: PrismaSnapshot) {
    this.id = snapshot.id;
    this.createdAt = snapshot.createdAt;
    this.updatedAt = snapshot.updatedAt;
    this.connectorAccountId = snapshot.connectorAccountId;
    this.tables = snapshot.tableSpecs as AnyTableSpec[];
  }
}
