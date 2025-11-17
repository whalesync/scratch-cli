import { SnapshotCluster, SnapshotTableCluster } from 'src/db/cluster-types';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';

/**
 * Get snapshot table by its ID (recommended)
 */
export function getSnapshotTableById(
  snapshot: SnapshotCluster.Snapshot,
  tableId: string,
): SnapshotTableCluster.SnapshotTable | undefined {
  return snapshot.snapshotTables?.find((t) => t.id === tableId);
}

/**
 * Get table spec by snapshot table ID (recommended)
 */
export function getTableSpecById(snapshot: SnapshotCluster.Snapshot, tableId: string): AnyTableSpec | undefined {
  const snapshotTable = getSnapshotTableById(snapshot, tableId);
  if (!snapshotTable) {
    return undefined;
  }
  return snapshotTable.tableSpec as AnyTableSpec;
}

/**
 * @deprecated Use getSnapshotTableById instead. This function uses the old wsId from tableSpec.
 */
export function getSnapshotTableByWsId(
  snapshot: SnapshotCluster.Snapshot,
  wsId: string,
): SnapshotTableCluster.SnapshotTable | undefined {
  return snapshot.snapshotTables?.find((t) => (t.tableSpec as AnyTableSpec).id.wsId === wsId);
}

/**
 * @deprecated Use getTableSpecById instead. This function uses the old wsId from tableSpec.
 */
export function getTableSpecByWsId(snapshot: SnapshotCluster.Snapshot, wsId: string): AnyTableSpec | undefined {
  const snapshotTable = getSnapshotTableByWsId(snapshot, wsId);
  if (!snapshotTable) {
    return undefined;
  }
  return snapshotTable.tableSpec as AnyTableSpec;
}
