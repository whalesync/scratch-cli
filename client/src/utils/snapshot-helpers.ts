import { Snapshot, SnapshotTable } from '@/types/server-entities/snapshot';

/**
 * Ensures a snapshot has snapshotTables by creating virtual ones from legacy fields if needed.
 * This provides backward compatibility for snapshots created before the SnapshotTable refactor.
 */
export function normalizeSnapshot(snapshot: Snapshot | undefined | null): Snapshot | undefined | null {
  if (!snapshot) return snapshot;

  // If snapshot already has snapshotTables, return as-is
  if (snapshot.snapshotTables && snapshot.snapshotTables.length > 0) {
    return snapshot;
  }

  // For old snapshots without snapshotTables, create virtual SnapshotTable objects
  // from the legacy fields (tables, tableContexts, etc.)
  if (snapshot.tables && snapshot.tables.length > 0) {
    const virtualSnapshotTables: SnapshotTable[] = snapshot.tables.map((tableSpec, index) => ({
      id: `virtual_${tableSpec.id.wsId}`, // Virtual ID for old snapshots
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      snapshotId: snapshot.id,
      connectorAccountId: snapshot.connectorAccountId ?? null,
      connectorDisplayName: snapshot.connectorDisplayName ?? null,
      connectorService: snapshot.connectorService ?? null,
      tableSpec,
      tableContext: snapshot.tableContexts[index] || null,
      columnContexts: snapshot.columnContexts?.[tableSpec.id.wsId] || {},
      activeRecordSqlFilter: snapshot.activeRecordSqlFilter?.[tableSpec.id.wsId] || null,
      hidden: false, // Default to not hidden for backward compatibility
    }));

    return {
      ...snapshot,
      snapshotTables: virtualSnapshotTables,
    };
  }

  return snapshot;
}

/**
 * Get visible snapshotTables from a snapshot, creating virtual ones if needed for backward compatibility.
 * By default, hidden tables are filtered out.
 */
export function getSnapshotTables(snapshot: Snapshot | undefined | null, includeHidden = false): SnapshotTable[] {
  const normalized = normalizeSnapshot(snapshot);
  const allTables = normalized?.snapshotTables || [];

  if (includeHidden) {
    return allTables;
  }

  return allTables.filter(table => !table.hidden);
}
