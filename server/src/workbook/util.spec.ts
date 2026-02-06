import { WorkbookCluster } from 'src/db/cluster-types';
import { deduplicateFileName, getSnapshotTableByWsId, getTableSpecByWsId, resolveBaseFileName } from './util';

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
        workbookId: 'workbook-1',
        tableSpec,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot = {
        id: 'workbook-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Workbook',
        snapshotTables: [snapshotTable],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as WorkbookCluster.Workbook;

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
        workbookId: 'workbook-1',
        tableSpec,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot = {
        id: 'workbook-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        snapshotTables: [snapshotTable],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as WorkbookCluster.Workbook;

      const result = getSnapshotTableByWsId(snapshot, 'non-existent-ws-id');

      expect(result).toBeUndefined();
    });

    it('should return undefined when snapshotTables is empty', () => {
      const snapshot = {
        id: 'workbook-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        snapshotTables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as WorkbookCluster.Workbook;

      const result = getSnapshotTableByWsId(snapshot, 'test-ws-id');

      expect(result).toBeUndefined();
    });

    it('should return undefined when snapshotTables is undefined', () => {
      const snapshot = {
        id: 'workbook-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as WorkbookCluster.Workbook;

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
        workbookId: 'workbook-1',
        tableSpec: tableSpec1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshotTable2 = {
        id: 'table-2',
        workbookId: 'workbook-1',
        tableSpec: tableSpec2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshotTable3 = {
        id: 'table-3',
        workbookId: 'workbook-1',
        tableSpec: tableSpec3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot = {
        id: 'workbook-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        snapshotTables: [snapshotTable1, snapshotTable2, snapshotTable3],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as WorkbookCluster.Workbook;

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
        workbookId: 'workbook-1',
        tableSpec,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot = {
        id: 'workbook-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        snapshotTables: [snapshotTable],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as WorkbookCluster.Workbook;

      const result = getTableSpecByWsId(snapshot, 'test-ws-id');

      expect(result).toBe(tableSpec);
    });

    it('should return undefined when snapshot table does not exist', () => {
      const snapshot = {
        id: 'workbook-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        snapshotTables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as WorkbookCluster.Workbook;

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
        workbookId: 'workbook-1',
        tableSpec,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot = {
        id: 'workbook-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        snapshotTables: [snapshotTable],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as WorkbookCluster.Workbook;

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
        workbookId: 'workbook-1',
        tableSpec: tableSpec1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshotTable2 = {
        id: 'table-2',
        workbookId: 'workbook-1',
        tableSpec: tableSpec2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot = {
        id: 'workbook-1',
        userId: 'user-1',
        organizationId: 'org-1',
        name: 'Test Snapshot',
        snapshotTables: [snapshotTable1, snapshotTable2],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as WorkbookCluster.Workbook;

      const result = getTableSpecByWsId(snapshot, 'ws-id-2');

      expect(result).toBe(tableSpec2);
    });
  });
});

describe('resolveBaseFileName', () => {
  it('should return normalized slug when slug is present', () => {
    expect(resolveBaseFileName({ slugValue: 'My Product', idValue: 'abc123' })).toBe('my-product');
  });

  it('should return normalized title when slug is missing but title is present', () => {
    expect(resolveBaseFileName({ titleValue: 'Blog Post Title', idValue: 'abc123' })).toBe('blog-post-title');
  });

  it('should return ID when both slug and title are missing', () => {
    expect(resolveBaseFileName({ idValue: 'abc123' })).toBe('abc123');
  });

  it('should return ID when slug is empty string', () => {
    expect(resolveBaseFileName({ slugValue: '', idValue: 'abc123' })).toBe('abc123');
  });

  it('should return ID when slug is whitespace only', () => {
    expect(resolveBaseFileName({ slugValue: '   ', idValue: 'abc123' })).toBe('abc123');
  });

  it('should fall through to title when slug is null', () => {
    expect(resolveBaseFileName({ slugValue: null, titleValue: 'My Title', idValue: 'abc123' })).toBe('my-title');
  });

  it('should normalize accented characters in slug', () => {
    expect(resolveBaseFileName({ slugValue: 'café-résumé', idValue: 'abc123' })).toBe('cafe-resume');
  });

  it('should normalize special characters in slug', () => {
    expect(resolveBaseFileName({ slugValue: 'hello_world!@#', idValue: 'abc123' })).toBe('helloworld');
  });
});

describe('deduplicateFileName', () => {
  it('should return base name when no collision', () => {
    const existing = new Set<string>();
    expect(deduplicateFileName('my-post', '.json', existing, 'rec001')).toBe('my-post.json');
  });

  it('should append record ID when collision occurs', () => {
    const existing = new Set<string>(['my-post.json']);
    expect(deduplicateFileName('my-post', '.json', existing, 'rec001')).toBe('my-post-rec001.json');
  });

  it('should add the final name to the existing set', () => {
    const existing = new Set<string>();
    deduplicateFileName('my-post', '.json', existing, 'rec001');
    expect(existing.has('my-post.json')).toBe(true);
  });

  it('should add the deduped name to the existing set on collision', () => {
    const existing = new Set<string>(['my-post.json']);
    deduplicateFileName('my-post', '.json', existing, 'rec001');
    expect(existing.has('my-post-rec001.json')).toBe(true);
  });

  it('should handle .md extension', () => {
    const existing = new Set<string>(['my-post.md']);
    expect(deduplicateFileName('my-post', '.md', existing, 'rec001')).toBe('my-post-rec001.md');
  });
});
