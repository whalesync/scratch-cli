import { SnapshotCluster } from 'src/db/cluster-types';
import { getSnapshotTableByWsId, getTableSpecByWsId } from './util';

describe('Snapshot Utilities', () => {
  describe('getSnapshotTableByWsId', () => {
    it('should return snapshot table when wsId matches', () => {
      const tableSpec = {
        id: { wsId: 'test-ws-id', remoteId: ['test-id'] },
        name: 'Test Table',
        columns: [],
      };

      const snapshotTable = {
        id: 'table-1',
        snapshotId: 'snapshot-1',
        tableSpec,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot = {
        id: 'snapshot-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        snapshotTables: [snapshotTable],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as SnapshotCluster.Snapshot;

      const result = getSnapshotTableByWsId(snapshot, 'test-ws-id');

      expect(result).toBe(snapshotTable);
    });

    it('should return undefined when wsId does not match', () => {
      const tableSpec = {
        id: { wsId: 'test-ws-id', remoteId: ['test-id'] },
        name: 'Test Table',
        columns: [],
      };

      const snapshotTable = {
        id: 'table-1',
        snapshotId: 'snapshot-1',
        tableSpec,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot = {
        id: 'snapshot-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        snapshotTables: [snapshotTable],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as SnapshotCluster.Snapshot;

      const result = getSnapshotTableByWsId(snapshot, 'non-existent-ws-id');

      expect(result).toBeUndefined();
    });

    it('should return undefined when snapshotTables is empty', () => {
      const snapshot = {
        id: 'snapshot-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        snapshotTables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as SnapshotCluster.Snapshot;

      const result = getSnapshotTableByWsId(snapshot, 'test-ws-id');

      expect(result).toBeUndefined();
    });

    it('should return undefined when snapshotTables is undefined', () => {
      const snapshot = {
        id: 'snapshot-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as SnapshotCluster.Snapshot;

      const result = getSnapshotTableByWsId(snapshot, 'test-ws-id');

      expect(result).toBeUndefined();
    });

    it('should find the correct table when multiple tables exist', () => {
      const tableSpec1 = {
        id: { wsId: 'ws-id-1', remoteId: ['id-1'] },
        name: 'Table 1',
        columns: [],
      };

      const tableSpec2 = {
        id: { wsId: 'ws-id-2', remoteId: ['id-2'] },
        name: 'Table 2',
        columns: [],
      };

      const tableSpec3 = {
        id: { wsId: 'ws-id-3', remoteId: ['id-3'] },
        name: 'Table 3',
        columns: [],
      };

      const snapshotTable1 = {
        id: 'table-1',
        snapshotId: 'snapshot-1',
        tableSpec: tableSpec1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshotTable2 = {
        id: 'table-2',
        snapshotId: 'snapshot-1',
        tableSpec: tableSpec2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshotTable3 = {
        id: 'table-3',
        snapshotId: 'snapshot-1',
        tableSpec: tableSpec3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot = {
        id: 'snapshot-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        snapshotTables: [snapshotTable1, snapshotTable2, snapshotTable3],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as SnapshotCluster.Snapshot;

      const result = getSnapshotTableByWsId(snapshot, 'ws-id-2');

      expect(result).toBe(snapshotTable2);
    });
  });

  describe('getTableSpecByWsId', () => {
    it('should return table spec when snapshot table exists', () => {
      const tableSpec = {
        id: { wsId: 'test-ws-id', remoteId: ['test-id'] },
        name: 'Test Table',
        columns: [],
      };

      const snapshotTable = {
        id: 'table-1',
        snapshotId: 'snapshot-1',
        tableSpec,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot = {
        id: 'snapshot-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        snapshotTables: [snapshotTable],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as SnapshotCluster.Snapshot;

      const result = getTableSpecByWsId(snapshot, 'test-ws-id');

      expect(result).toBe(tableSpec);
    });

    it('should return undefined when snapshot table does not exist', () => {
      const snapshot = {
        id: 'snapshot-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        snapshotTables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as SnapshotCluster.Snapshot;

      const result = getTableSpecByWsId(snapshot, 'non-existent-ws-id');

      expect(result).toBeUndefined();
    });

    it('should return undefined when wsId does not match any table', () => {
      const tableSpec = {
        id: { wsId: 'test-ws-id', remoteId: ['test-id'] },
        name: 'Test Table',
        columns: [],
      };

      const snapshotTable = {
        id: 'table-1',
        snapshotId: 'snapshot-1',
        tableSpec,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot = {
        id: 'snapshot-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        snapshotTables: [snapshotTable],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as SnapshotCluster.Snapshot;

      const result = getTableSpecByWsId(snapshot, 'different-ws-id');

      expect(result).toBeUndefined();
    });

    it('should return correct spec when multiple tables exist', () => {
      const tableSpec1 = {
        id: { wsId: 'ws-id-1', remoteId: ['id-1'] },
        name: 'Table 1',
        columns: [],
      };

      const tableSpec2 = {
        id: { wsId: 'ws-id-2', remoteId: ['id-2'] },
        name: 'Table 2',
        columns: [],
      };

      const snapshotTable1 = {
        id: 'table-1',
        snapshotId: 'snapshot-1',
        tableSpec: tableSpec1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshotTable2 = {
        id: 'table-2',
        snapshotId: 'snapshot-1',
        tableSpec: tableSpec2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot = {
        id: 'snapshot-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        snapshotTables: [snapshotTable1, snapshotTable2],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as SnapshotCluster.Snapshot;

      const result = getTableSpecByWsId(snapshot, 'ws-id-2');

      expect(result).toBe(tableSpec2);
    });
  });
});
