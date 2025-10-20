import { SnapshotCluster } from '../../db/cluster-types';
import { AnyTableSpec } from '../../remote-service/connectors/library/custom-spec-registry';
import { ActiveRecordSqlFilter, SnapshotColumnContexts, SnapshotTableContext } from '../types';

export class Snapshot {
  id: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
  connectorAccountId: string | null;
  connectorDisplayName: string | null;
  connectorService: string;
  tables: AnyTableSpec[];
  tableContexts: SnapshotTableContext[];
  activeRecordSqlFilter?: Record<string, string>;
  columnContexts: SnapshotColumnContexts;
  constructor(snapshot: SnapshotCluster.Snapshot) {
    this.id = snapshot.id;
    this.name = snapshot.name ?? null;
    this.createdAt = snapshot.createdAt;
    this.updatedAt = snapshot.updatedAt;
    this.connectorAccountId = snapshot.connectorAccountId;
    this.tables = snapshot.tableSpecs as AnyTableSpec[];
    this.connectorDisplayName = snapshot.connectorAccount?.displayName ?? null;
    this.connectorService = snapshot.service;
    this.tableContexts = snapshot.tableContexts as SnapshotTableContext[];
    this.columnContexts = snapshot.columnContexts as SnapshotColumnContexts;
    this.activeRecordSqlFilter = snapshot.activeRecordSqlFilter as ActiveRecordSqlFilter;
  }
}
