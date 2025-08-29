import { SnapshotCluster } from '../../db/cluster-types';
import { AnyTableSpec } from '../../remote-service/connectors/library/custom-spec-registry';
import { ActiveRecordSqlFilter, SnapshotTableContext } from '../types';

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
  activeRecordSqlFilter?: Record<string, string>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(snapshot: SnapshotCluster.Snapshot, includeActiveFilters: boolean = false) {
    this.id = snapshot.id;
    this.name = snapshot.name ?? null;
    this.createdAt = snapshot.createdAt;
    this.updatedAt = snapshot.updatedAt;
    this.connectorAccountId = snapshot.connectorAccountId;
    this.tables = snapshot.tableSpecs as AnyTableSpec[];
    this.connectorDisplayName = snapshot.connectorAccount.displayName;
    this.connectorService = snapshot.connectorAccount.service;
    this.tableContexts = snapshot.tableContexts as SnapshotTableContext[];

    this.activeRecordSqlFilter = snapshot.activeRecordSqlFilter as ActiveRecordSqlFilter;
    // if (includeActiveFilters && snapshot.activeRecordSqlFilter) {
    // }
  }
}
