import { SnapshotCluster } from '../../db/cluster-types';
import { AnyTableSpec } from '../../remote-service/connectors/library/custom-spec-registry';
import { SnapshotTableContext } from '../types';

export class Snapshot {
  id: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
  connectorAccountId: string;
  connectorDisplayName: string | null;
  connectorService: string | null;

  tables: AnyTableSpec[];

  tableContexts: SnapshotTableContext[];

  constructor(snapshot: SnapshotCluster.Snapshot) {
    this.id = snapshot.id;
    this.name = snapshot.name ?? null;
    this.createdAt = snapshot.createdAt;
    this.updatedAt = snapshot.updatedAt;
    this.connectorAccountId = snapshot.connectorAccountId;
    this.tables = snapshot.tableSpecs as AnyTableSpec[];
    this.connectorDisplayName = snapshot.connectorAccount.displayName;
    this.connectorService = snapshot.connectorAccount.service;
    this.tableContexts = snapshot.tableContexts as SnapshotTableContext[];
  }
}
