import { SnapshotCluster, SnapshotTableCluster } from 'src/db/cluster-types';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';

export function getSnapshotTableByWsId(
  snapshot: SnapshotCluster.Snapshot,
  wsId: string,
): SnapshotTableCluster.SnapshotTable | undefined {
  return snapshot.snapshotTables?.find((t) => (t.tableSpec as AnyTableSpec).id.wsId === wsId);
}

export function getTableSpecByWsId(snapshot: SnapshotCluster.Snapshot, wsId: string): AnyTableSpec | undefined {
  const snapshotTable = getSnapshotTableByWsId(snapshot, wsId);
  if (!snapshotTable) {
    return undefined;
  }
  return snapshotTable.tableSpec as AnyTableSpec;
}
