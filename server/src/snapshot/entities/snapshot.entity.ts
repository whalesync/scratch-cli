import { SnapshotCluster } from '../../db/cluster-types';
import { AnyTableSpec } from '../../remote-service/connectors/library/custom-spec-registry';
import { ActiveRecordSqlFilter, SnapshotColumnContexts, SnapshotTableContext } from '../types';
import { SnapshotTable as SnapshotTableEntity } from './snapshot-table.entity';

export class Snapshot {
  id: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  organizationId: string;

  /** @deprecated Use snapshotTables[].connectorAccountId instead - kept for backward compatibility during migration */
  connectorAccountId: string | null;
  /** @deprecated Use snapshotTables[].connectorDisplayName instead - kept for backward compatibility during migration */
  connectorDisplayName: string | null;
  /** @deprecated Use snapshotTables[].connectorService instead - kept for backward compatibility during migration */
  connectorService: string;

  tables: AnyTableSpec[];
  tableContexts: SnapshotTableContext[];
  activeRecordSqlFilter?: Record<string, string>;
  columnContexts: SnapshotColumnContexts;
  snapshotTables?: SnapshotTableEntity[];

  constructor(snapshot: SnapshotCluster.Snapshot) {
    this.id = snapshot.id;
    this.name = snapshot.name ?? null;
    this.createdAt = snapshot.createdAt;
    this.updatedAt = snapshot.updatedAt;
    this.userId = snapshot.userId;
    // TODO (DEV-8628): can be removed once migration to organizations is complete -- just here to warn about potential issues during switchover
    this.organizationId = snapshot.organizationId ?? 'unknown organization id';
    this.connectorAccountId = snapshot.connectorAccountId;
    this.connectorDisplayName = snapshot.connectorAccount?.displayName ?? null;
    this.connectorService = snapshot.service;
    this.tables = snapshot.tableSpecs as AnyTableSpec[];
    this.tableContexts = snapshot.tableContexts as SnapshotTableContext[];
    this.columnContexts = snapshot.columnContexts as SnapshotColumnContexts;
    this.activeRecordSqlFilter = snapshot.activeRecordSqlFilter as ActiveRecordSqlFilter;
    this.snapshotTables = snapshot.snapshotTables?.map((st) => new SnapshotTableEntity(st));
  }
}
