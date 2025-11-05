import { SnapshotTableCluster } from '../../db/cluster-types';
import { AnyTableSpec } from '../../remote-service/connectors/library/custom-spec-registry';
import { SnapshotColumnSettingsMap, SnapshotTableContext } from '../types';

export class SnapshotTable {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  snapshotId: string;
  connectorAccountId: string | null;
  connectorDisplayName: string | null;
  connectorService: string | null;
  tableSpec: AnyTableSpec;
  tableContext: SnapshotTableContext | null;
  columnSettings: SnapshotColumnSettingsMap;
  activeRecordSqlFilter: string | null;
  hidden: boolean;

  constructor(snapshotTable: SnapshotTableCluster.SnapshotTable) {
    this.id = snapshotTable.id;
    this.createdAt = snapshotTable.createdAt;
    this.updatedAt = snapshotTable.updatedAt;
    this.snapshotId = snapshotTable.snapshotId;
    this.connectorAccountId = snapshotTable.connectorAccountId;
    this.connectorDisplayName = snapshotTable.connectorAccount?.displayName ?? null;
    this.connectorService = snapshotTable.connectorService;
    this.tableSpec = snapshotTable.tableSpec as AnyTableSpec;
    this.tableContext = snapshotTable.tableContext as SnapshotTableContext | null;
    this.columnSettings = (snapshotTable.columnSettings as SnapshotColumnSettingsMap) ?? {};
    this.activeRecordSqlFilter = snapshotTable.activeRecordSqlFilter ?? null;
    this.hidden = snapshotTable.hidden;
  }
}
