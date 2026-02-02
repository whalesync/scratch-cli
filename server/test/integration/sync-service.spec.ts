import { PrismaClient } from '@prisma/client';
import {
  createDataFolderId,
  createSyncId,
  createWorkbookId,
  DataFolderId,
  SyncId,
  TableMapping,
  WorkbookId,
} from '@spinner/shared-types';
import { DbService } from 'src/db/db.service';
import { SyncService } from 'src/sync/sync.service';
import { Actor } from 'src/users/types';
import { FilesService } from 'src/workbook/files.service';

describe('SyncService - fillSyncCaches', () => {
  let prisma: PrismaClient;
  let syncService: SyncService;
  let filesService: FilesService;
  let dbService: DbService;

  // Test data
  let workbookId: WorkbookId;
  let sourceFolderId: DataFolderId;
  let destFolderId: DataFolderId;
  let syncId: SyncId;
  let orgId: string;
  let userId: string;
  const actor: Actor = { userId: 'test-user', organizationId: 'test-org' };

  beforeAll(() => {
    // Initialize Prisma client
    prisma = new PrismaClient();
  });

  beforeEach(async () => {
    // Create mock instances
    dbService = { client: prisma } as unknown as DbService;

    // We'll mock FilesService since it depends on git operations
    filesService = {
      getAllFileContentsByFolderId: jest.fn(),
    } as unknown as FilesService;

    // Create SyncService instance
    syncService = new SyncService(dbService, filesService);

    // Create test organization
    const org = await prisma.organization.create({
      data: {
        id: 'org_test_' + Date.now(),
        name: 'Test Org',
        clerkId: 'clerk_' + Date.now(),
      },
    });
    orgId = org.id;

    // Create user
    const user = await prisma.user.create({
      data: {
        id: 'user_test_' + Date.now(),
        email: `test-${Date.now()}@example.com`,
        organizationId: org.id,
      },
    });
    userId = user.id;

    // Create workbook
    const wbId = createWorkbookId();
    await prisma.workbook.create({
      data: {
        id: wbId,
        name: 'Test Workbook',
        userId: user.id,
        organizationId: org.id,
      },
    });
    workbookId = wbId;

    // Create source and destination data folders
    const srcFolderId = createDataFolderId();
    await prisma.dataFolder.create({
      data: {
        id: srcFolderId,
        name: 'Source Folder',
        workbookId,
        lastSchemaRefreshAt: new Date(),
      },
    });
    sourceFolderId = srcFolderId;

    const dstFolderId = createDataFolderId();
    await prisma.dataFolder.create({
      data: {
        id: dstFolderId,
        name: 'Destination Folder',
        workbookId,
        lastSchemaRefreshAt: new Date(),
      },
    });
    destFolderId = dstFolderId;

    // Create sync
    const synId = createSyncId();
    await prisma.sync.create({
      data: {
        id: synId,
        displayName: 'Test Sync',
        mappings: [],
      },
    });
    syncId = synId;
  });

  afterEach(async () => {
    // Clean up test data belonging to this test run only
    // Sync deletion cascades to SyncMatchKeys and SyncRemoteIdMapping
    // Org deletion cascades to workbook → dataFolder (and also to sync caches via dataFolderId)
    await prisma.sync.delete({ where: { id: syncId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.organization.delete({ where: { id: orgId } });
    await prisma.syncMatchKeys.deleteMany({ where: { syncId: syncId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should populate SyncMatchKeys and SyncRemoteIdMapping for matching records', async () => {
    // Mock file data for source and destination
    const sourceFiles = [
      { folderId: sourceFolderId, path: '/file1.md', content: '---\nemail: john@example.com\n---\nContent 1' },
      { folderId: sourceFolderId, path: '/file2.md', content: '---\nemail: jane@example.com\n---\nContent 2' },
      { folderId: sourceFolderId, path: '/file3.md', content: '---\nemail: bob@example.com\n---\nContent 3' },
    ];

    const destFiles = [
      { folderId: destFolderId, path: '/item1.md', content: '---\nemail: john@example.com\n---\nDest 1' },
      { folderId: destFolderId, path: '/item2.md', content: '---\nemail: jane@example.com\n---\nDest 2' },
    ];

    // Mock FilesService
    (filesService.getAllFileContentsByFolderId as jest.Mock).mockImplementation((_workbookIdArg, folderIdArg) => {
      if (folderIdArg === sourceFolderId) {
        return Promise.resolve(sourceFiles);
      } else if (folderIdArg === destFolderId) {
        return Promise.resolve(destFiles);
      }
      return Promise.resolve([]);
    });

    // Create table mapping with record matching
    const tableMapping: TableMapping = {
      sourceDataFolderId: sourceFolderId,
      destinationDataFolderId: destFolderId,
      columnMappings: [],
      recordMatching: {
        sourceColumnId: 'email',
        destinationColumnId: 'email',
      },
    };

    // Call fillSyncCaches
    const result = await syncService.fillSyncCaches(syncId, tableMapping, workbookId, actor);

    // Verify source and destination records were returned
    expect(result.sourceRecords).toHaveLength(3);
    expect(result.destinationRecords).toHaveLength(2);

    // Verify SyncMatchKeys were inserted for both sides
    const sourceMatches = await prisma.syncMatchKeys.findMany({
      where: { syncId, dataFolderId: sourceFolderId },
    });
    expect(sourceMatches).toHaveLength(3);
    const sourceRemoteIds = (sourceMatches as { remoteId: string }[]).map((m) => m.remoteId);
    sourceRemoteIds.sort();
    const expectedSourceIds = ['/file1.md', '/file2.md', '/file3.md'];
    expectedSourceIds.sort();
    expect(sourceRemoteIds).toEqual(expectedSourceIds);

    const destMatches = await prisma.syncMatchKeys.findMany({
      where: { syncId, dataFolderId: destFolderId },
    });
    expect(destMatches).toHaveLength(2);
    const destRemoteIds = (destMatches as { remoteId: string }[]).map((m) => m.remoteId);
    destRemoteIds.sort();
    const expectedDestIds = ['/item1.md', '/item2.md'];
    expectedDestIds.sort();
    expect(destRemoteIds).toEqual(expectedDestIds);

    // Verify SyncRemoteIdMappings were created for all source records
    // (matched records have destinationRemoteId, unmatched have null)
    const mappings = await prisma.syncRemoteIdMapping.findMany({
      where: { syncId, dataFolderId: sourceFolderId },
    });

    expect(mappings).toHaveLength(3);

    // Verify mapping integrity: check that john@example.com and jane@example.com are mapped
    const johnMapping = mappings.find((m) => m.sourceRemoteId === '/file1.md');
    expect(johnMapping).toBeDefined();
    expect(johnMapping?.destinationRemoteId).toBe('/item1.md');

    const janeMapping = mappings.find((m) => m.sourceRemoteId === '/file2.md');
    expect(janeMapping).toBeDefined();
    expect(janeMapping?.destinationRemoteId).toBe('/item2.md');

    // Bob's file should have a mapping with null destinationRemoteId since it doesn't exist in destination
    const bobMapping = mappings.find((m) => m.sourceRemoteId === '/file3.md');
    expect(bobMapping).toBeDefined();
    expect(bobMapping?.destinationRemoteId).toBeNull();
  });

  it('should handle empty file lists', async () => {
    // Mock empty file lists
    (filesService.getAllFileContentsByFolderId as jest.Mock).mockResolvedValue([]);

    const tableMapping: TableMapping = {
      sourceDataFolderId: sourceFolderId,
      destinationDataFolderId: destFolderId,
      columnMappings: [],
      recordMatching: {
        sourceColumnId: 'email',
        destinationColumnId: 'email',
      },
    };

    const result = await syncService.fillSyncCaches(syncId, tableMapping, workbookId, actor);

    expect(result.sourceRecords).toHaveLength(0);
    expect(result.destinationRecords).toHaveLength(0);

    const matchKeys = await prisma.syncMatchKeys.findMany({ where: { syncId } });
    expect(matchKeys).toHaveLength(0);

    const mappings = await prisma.syncRemoteIdMapping.findMany({ where: { syncId } });
    expect(mappings).toHaveLength(0);
  });

  it('should handle records without matching column values', async () => {
    // Files without the matching column
    const sourceFiles = [{ folderId: sourceFolderId, path: '/file1.md', content: '---\nname: John\n---\nContent' }];

    const destFiles = [{ folderId: destFolderId, path: '/item1.md', content: '---\nname: Jane\n---\nContent' }];

    (filesService.getAllFileContentsByFolderId as jest.Mock).mockImplementation((_workbookIdArg, folderIdArg) => {
      if (folderIdArg === sourceFolderId) {
        return Promise.resolve(sourceFiles);
      } else if (folderIdArg === destFolderId) {
        return Promise.resolve(destFiles);
      }
      return Promise.resolve([]);
    });

    const tableMapping: TableMapping = {
      sourceDataFolderId: sourceFolderId,
      destinationDataFolderId: destFolderId,
      columnMappings: [],
      recordMatching: {
        sourceColumnId: 'email', // Column doesn't exist in files
        destinationColumnId: 'email',
      },
    };

    const result = await syncService.fillSyncCaches(syncId, tableMapping, workbookId, actor);

    expect(result.sourceRecords).toHaveLength(1);
    expect(result.destinationRecords).toHaveLength(1);

    // No mappings should be created since no match keys were created
    // (records don't have the matching column values)
    const mappings = await prisma.syncRemoteIdMapping.findMany({ where: { syncId } });
    expect(mappings).toHaveLength(0);
  });
});
