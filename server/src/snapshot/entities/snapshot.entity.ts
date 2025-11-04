import { SnapshotCluster } from '../../db/cluster-types';
import { SnapshotColumnContexts } from '../types';
import { SnapshotTable as SnapshotTableEntity } from './snapshot-table.entity';

export class Snapshot {
  id: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string | null;
  organizationId: string;

  /** @deprecated Use snapshotTables[].connectorAccountId instead - kept for backward compatibility during migration */
  connectorAccountId: string | null;
  /** @deprecated Use snapshotTables[].connectorDisplayName instead - kept for backward compatibility during migration */
  connectorDisplayName: string | null;
  /** @deprecated Use snapshotTables[].connectorService instead - kept for backward compatibility during migration */
  connectorService: string;

  columnContexts: SnapshotColumnContexts;
  snapshotTables?: SnapshotTableEntity[];

  constructor(snapshot: SnapshotCluster.Snapshot) {
    this.id = snapshot.id;
    this.name = snapshot.name ?? null;
    this.createdAt = snapshot.createdAt;
    this.updatedAt = snapshot.updatedAt;
    this.userId = snapshot.userId ?? null;
    this.organizationId = snapshot.organizationId;
    this.connectorAccountId = snapshot.connectorAccountId;
    this.connectorDisplayName = snapshot.connectorAccount?.displayName ?? null;
    this.connectorService = snapshot.service;
    this.columnContexts = snapshot.columnContexts as SnapshotColumnContexts;
    this.snapshotTables = snapshot.snapshotTables?.map((st) => new SnapshotTableEntity(st));
  }
}
