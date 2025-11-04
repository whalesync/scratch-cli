import { Snapshot, SnapshotTable } from '@/types/server-entities/snapshot';
/**
 * Get visible snapshotTables from a snapshot, creating virtual ones if needed for backward compatibility.
 * By default, hidden tables are filtered out.
 */
export function getSnapshotTables(snapshot: Snapshot | undefined | null, includeHidden = false): SnapshotTable[] {
  const allTables = snapshot?.snapshotTables || [];

  if (includeHidden) {
    return allTables;
  }

  return allTables.filter(table => !table.hidden);
}
