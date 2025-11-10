import { SnapshotTableCluster } from '../../db/cluster-types';
import { AnyTableSpec } from '../../remote-service/connectors/library/custom-spec-registry';
import { SnapshotColumnSettingsMap } from '../types';

export class SnapshotTable {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  snapshotId: string;
  connectorAccountId: string | null;
  connectorDisplayName: string | null;
  connectorService: string | null;
  tableSpec: AnyTableSpec;
  columnSettings: SnapshotColumnSettingsMap;
  activeRecordSqlFilter: string | null;
  pageSize: number | null;
  hidden: boolean;
  syncInProgress: boolean;
  hiddenColumns: string[];

  constructor(snapshotTable: SnapshotTableCluster.SnapshotTable) {
    this.id = snapshotTable.id;
    this.createdAt = snapshotTable.createdAt;
    this.updatedAt = snapshotTable.updatedAt;
    this.snapshotId = snapshotTable.snapshotId;
    this.connectorAccountId = snapshotTable.connectorAccountId;
    this.connectorDisplayName = snapshotTable.connectorAccount?.displayName ?? null;
    this.connectorService = snapshotTable.connectorService;
    this.tableSpec = snapshotTable.tableSpec as AnyTableSpec;
    this.columnSettings = (snapshotTable.columnSettings as SnapshotColumnSettingsMap) ?? {};
    this.activeRecordSqlFilter = snapshotTable.activeRecordSqlFilter ?? null;
    this.pageSize = snapshotTable.pageSize ?? null;
    this.hidden = snapshotTable.hidden;
    this.syncInProgress = snapshotTable.syncInProgress;
    this.hiddenColumns = snapshotTable.hiddenColumns ?? [];
  }
}
