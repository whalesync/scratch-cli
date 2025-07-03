import { SnapshotCluster } from '../../db/cluster-types';
import { AnyTableSpec } from '../../remote-service/connectors/library/custom-spec-registry';

export class Snapshot {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  connectorAccountId: string;
  connectorDisplayName: string | null;
  connectorService: string | null;

  tables: AnyTableSpec[];

  constructor(snapshot: SnapshotCluster.Snapshot) {
    this.id = snapshot.id;
    this.createdAt = snapshot.createdAt;
    this.updatedAt = snapshot.updatedAt;
    this.connectorAccountId = snapshot.connectorAccountId;
    this.tables = snapshot.tableSpecs as AnyTableSpec[];
    this.connectorDisplayName = snapshot.connectorAccount.displayName;
    this.connectorService = snapshot.connectorAccount.service;
  }
}
