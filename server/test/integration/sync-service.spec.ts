import { PrismaClient } from '@prisma/client';
import {
  AnyColumnMapping,
  createDataFolderId,
  createSyncId,
  createWorkbookId,
  DataFolderId,
  SyncId,
  TableMapping,
  WorkbookId,
} from '@spinner/shared-types';
import { DbService } from 'src/db/db.service';
import { DIRTY_BRANCH, ScratchGitService } from 'src/scratch-git/scratch-git.service';
import { SyncService } from 'src/sync/sync.service';
import { Actor } from 'src/users/types';
import { DataFolderService } from 'src/workbook/data-folder.service';

describe('SyncService - fillSyncCaches', () => {
  let prisma: PrismaClient;
  let syncService: SyncService;
  let dataFolderService: DataFolderService;
  let scratchGitService: ScratchGitService;
  let dbService: DbService;

  // Test data
  let workbookId: WorkbookId;
  let sourceFolderId: DataFolderId;
  let destFolderId: DataFolderId;
  let syncId: SyncId;
  let orgId: string;
  let userId: string;

  beforeAll(() => {
    // Initialize Prisma client
    prisma = new PrismaClient();
  });

  beforeEach(async () => {
    // Create mock instances
    dbService = { client: prisma } as unknown as DbService;

    // We'll mock DataFolderService since it depends on git operations
    dataFolderService = {
      getAllFileContentsByFolderId: jest.fn(),
    } as unknown as DataFolderService;

    // Shouldn't be called
    scratchGitService = {} as unknown as ScratchGitService;

    // Create SyncService instance (workbookService not needed for these tests)
    syncService = new SyncService(dbService, dataFolderService, scratchGitService, {} as never);

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
    // Create source and destination records
    const sourceRecords = [
      { id: '/file1.json', fields: { email: 'john@example.com' } },
      { id: '/file2.json', fields: { email: 'jane@example.com' } },
      { id: '/file3.json', fields: { email: 'bob@example.com' } },
    ];

    const destinationRecords = [
      { id: '/item1.json', fields: { email: 'john@example.com' } },
      { id: '/item2.json', fields: { email: 'jane@example.com' } },
    ];

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

    // Call fillSyncCaches with records
    await syncService.fillSyncCaches(syncId, tableMapping, sourceRecords, destinationRecords);

    // Verify SyncMatchKeys were inserted for both sides
    const sourceMatches = await prisma.syncMatchKeys.findMany({
      where: { syncId, dataFolderId: sourceFolderId },
    });
    expect(sourceMatches).toHaveLength(3);
    const sourceRemoteIds = (sourceMatches as { remoteId: string }[]).map((m) => m.remoteId);
    sourceRemoteIds.sort();
    const expectedSourceIds = ['/file1.json', '/file2.json', '/file3.json'];
    expectedSourceIds.sort();
    expect(sourceRemoteIds).toEqual(expectedSourceIds);

    const destMatches = await prisma.syncMatchKeys.findMany({
      where: { syncId, dataFolderId: destFolderId },
    });
    expect(destMatches).toHaveLength(2);
    const destRemoteIds = (destMatches as { remoteId: string }[]).map((m) => m.remoteId);
    destRemoteIds.sort();
    const expectedDestIds = ['/item1.json', '/item2.json'];
    expectedDestIds.sort();
    expect(destRemoteIds).toEqual(expectedDestIds);

    // Verify SyncRemoteIdMappings were created for all source records
    // (matched records have destinationRemoteId, unmatched have null)
    const mappings = await prisma.syncRemoteIdMapping.findMany({
      where: { syncId, dataFolderId: sourceFolderId },
    });

    expect(mappings).toHaveLength(3);

    // Verify mapping integrity: check that john@example.com and jane@example.com are mapped
    const johnMapping = mappings.find((m) => m.sourceRemoteId === '/file1.json');
    expect(johnMapping).toBeDefined();
    expect(johnMapping?.destinationRemoteId).toBe('/item1.json');

    const janeMapping = mappings.find((m) => m.sourceRemoteId === '/file2.json');
    expect(janeMapping).toBeDefined();
    expect(janeMapping?.destinationRemoteId).toBe('/item2.json');

    // Bob's file should have a mapping with null destinationRemoteId since it doesn't exist in destination
    const bobMapping = mappings.find((m) => m.sourceRemoteId === '/file3.json');
    expect(bobMapping).toBeDefined();
    expect(bobMapping?.destinationRemoteId).toBeNull();
  });

  it('should handle empty record lists', async () => {
    const tableMapping: TableMapping = {
      sourceDataFolderId: sourceFolderId,
      destinationDataFolderId: destFolderId,
      columnMappings: [],
      recordMatching: {
        sourceColumnId: 'email',
        destinationColumnId: 'email',
      },
    };

    await syncService.fillSyncCaches(syncId, tableMapping, [], []);

    const matchKeys = await prisma.syncMatchKeys.findMany({ where: { syncId } });
    expect(matchKeys).toHaveLength(0);

    const mappings = await prisma.syncRemoteIdMapping.findMany({ where: { syncId } });
    expect(mappings).toHaveLength(0);
  });

  it('should handle records without matching column values', async () => {
    // Records without the matching column
    const sourceRecords = [{ id: '/file1.json', fields: { name: 'John' } }];
    const destinationRecords = [{ id: '/item1.json', fields: { name: 'Jane' } }];

    const tableMapping: TableMapping = {
      sourceDataFolderId: sourceFolderId,
      destinationDataFolderId: destFolderId,
      columnMappings: [],
      recordMatching: {
        sourceColumnId: 'email', // Column doesn't exist in records
        destinationColumnId: 'email',
      },
    };

    await syncService.fillSyncCaches(syncId, tableMapping, sourceRecords, destinationRecords);

    // No mappings should be created since no match keys were created
    // (records don't have the matching column values)
    const mappings = await prisma.syncRemoteIdMapping.findMany({ where: { syncId } });
    expect(mappings).toHaveLength(0);
  });
});

describe('SyncService - syncTableMapping', () => {
  let prisma: PrismaClient;
  let syncService: SyncService;
  let dataFolderService: DataFolderService;
  let scratchGitService: ScratchGitService;
  let dbService: DbService;

  // Test data
  let workbookId: WorkbookId;
  let sourceFolderId: DataFolderId;
  let destFolderId: DataFolderId;
  let syncId: SyncId;
  let orgId: string;
  let userId: string;
  const actor: Actor = { userId: 'test-user', organizationId: 'test-org' };

  // Track written files for verification
  let writtenFiles: Array<{ path: string; content: string }>;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  beforeEach(async () => {
    writtenFiles = [];

    dbService = { client: prisma } as unknown as DbService;

    dataFolderService = {
      getAllFileContentsByFolderId: jest.fn(),
      findOne: jest.fn(),
    } as unknown as DataFolderService;

    scratchGitService = {
      commitFilesToBranch: jest
        .fn()
        .mockImplementation((_workbookId, _branch, files: Array<{ path: string; content: string }>) => {
          writtenFiles.push(...files);
          return Promise.resolve();
        }),
    } as unknown as ScratchGitService;

    syncService = new SyncService(dbService, dataFolderService, scratchGitService, {} as never);

    // Create test organization
    const org = await prisma.organization.create({
      data: {
        id: 'org_sync_test_' + Date.now(),
        name: 'Test Org',
        clerkId: 'clerk_sync_' + Date.now(),
      },
    });
    orgId = org.id;

    // Create user
    const user = await prisma.user.create({
      data: {
        id: 'user_sync_test_' + Date.now(),
        email: `sync-test-${Date.now()}@example.com`,
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

    // Create source and destination data folders with schema containing idColumnRemoteId
    const srcFolderId = createDataFolderId();
    await prisma.dataFolder.create({
      data: {
        id: srcFolderId,
        name: 'Source Folder',
        workbookId,
        path: '/src',
        schema: { idColumnRemoteId: 'id' },
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
        path: '/dest',
        schema: { idColumnRemoteId: 'id' },
        lastSchemaRefreshAt: new Date(),
      },
    });
    destFolderId = dstFolderId;

    // Mock findOne to return folder info with path
    (dataFolderService.findOne as jest.Mock).mockImplementation((folderId) => {
      if (folderId === destFolderId) {
        return Promise.resolve({ path: '/dest' });
      }
      return Promise.resolve({ path: '/src' });
    });

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
    await prisma.sync.delete({ where: { id: syncId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.organization.delete({ where: { id: orgId } });
    await prisma.syncMatchKeys.deleteMany({ where: { syncId: syncId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create new records in destination when none exist', async () => {
    const sourceFiles = [
      {
        folderId: sourceFolderId,
        path: 'src/file1.json',
        content: '{"id": "rec1", "email": "john@example.com", "name": "John"}',
      },
      {
        folderId: sourceFolderId,
        path: 'src/file2.json',
        content: '{"id": "rec2", "email": "jane@example.com", "name": "Jane"}',
      },
      {
        folderId: sourceFolderId,
        path: 'src/file3.json',
        content: '{"id": "rec3", "email": "bob@example.com", "name": "Bob"}',
      },
    ];

    // No destination files - all source records are new
    const destFiles: typeof sourceFiles = [];

    (dataFolderService.getAllFileContentsByFolderId as jest.Mock).mockImplementation((_workbookIdArg, folderIdArg) => {
      if (folderIdArg === sourceFolderId) {
        return Promise.resolve(sourceFiles);
      } else if (folderIdArg === destFolderId) {
        return Promise.resolve(destFiles);
      }
      return Promise.resolve([]);
    });

    const columnMappings: AnyColumnMapping[] = [
      { type: 'local', sourceColumnId: 'email', destinationColumnId: 'email_address' },
      { type: 'local', sourceColumnId: 'name', destinationColumnId: 'full_name' },
    ];

    const tableMapping: TableMapping = {
      sourceDataFolderId: sourceFolderId,
      destinationDataFolderId: destFolderId,
      columnMappings,
      recordMatching: {
        sourceColumnId: 'email',
        destinationColumnId: 'email_address',
      },
    };

    const result = await syncService.syncTableMapping(syncId, tableMapping, workbookId, actor);

    expect(result.recordsCreated).toBe(3);
    expect(result.recordsUpdated).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Verify commitFilesToBranch was called
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(scratchGitService.commitFilesToBranch).toHaveBeenCalledWith(
      workbookId,
      DIRTY_BRANCH,
      expect.any(Array),
      'Sync: batch write files',
    );

    // Verify files were written with transformed content
    // New files get generated paths with file IDs (e.g., dest/pending-publish-xxx.json)
    expect(writtenFiles).toHaveLength(3);
    expect(writtenFiles.every((f) => f.path.startsWith('dest/pending-publish-') && f.path.endsWith('.json'))).toBe(true);

    // Verify one of the files has the correct transformed content
    const file1Content = JSON.parse(writtenFiles[0].content) as Record<string, unknown>;
    expect(file1Content.email_address).toBeDefined();
    expect(file1Content.full_name).toBeDefined();

    // Verify SyncRemoteIdMappings were updated with destination IDs (file paths)
    const mappings = await prisma.syncRemoteIdMapping.findMany({
      where: { syncId, dataFolderId: sourceFolderId },
    });
    expect(mappings).toHaveLength(3);
    expect(mappings.every((m) => m.destinationRemoteId !== null)).toBe(true);
    // New mappings should point to generated file paths
    expect(mappings.every((m) => m.destinationRemoteId?.startsWith('dest/pending-publish-'))).toBe(true);
  });

  it('should update existing records when they match', async () => {
    const sourceFiles = [
      {
        folderId: sourceFolderId,
        path: 'src/file1.json',
        content: '{"id": "rec1", "email": "john@example.com", "name": "John Updated"}',
      },
      {
        folderId: sourceFolderId,
        path: 'src/file2.json',
        content: '{"id": "rec2", "email": "jane@example.com", "name": "Jane Updated"}',
      },
    ];

    const destFiles = [
      {
        folderId: destFolderId,
        path: 'dest/item1.json',
        content: '{"id": "dest1", "email": "john@example.com", "name": "John"}',
      },
      {
        folderId: destFolderId,
        path: 'dest/item2.json',
        content: '{"id": "dest2", "email": "jane@example.com", "name": "Jane"}',
      },
    ];

    (dataFolderService.getAllFileContentsByFolderId as jest.Mock).mockImplementation((_workbookIdArg, folderIdArg) => {
      if (folderIdArg === sourceFolderId) {
        return Promise.resolve(sourceFiles);
      } else if (folderIdArg === destFolderId) {
        return Promise.resolve(destFiles);
      }
      return Promise.resolve([]);
    });

    const columnMappings: AnyColumnMapping[] = [
      { type: 'local', sourceColumnId: 'email', destinationColumnId: 'email' },
      { type: 'local', sourceColumnId: 'name', destinationColumnId: 'name' },
    ];

    const tableMapping: TableMapping = {
      sourceDataFolderId: sourceFolderId,
      destinationDataFolderId: destFolderId,
      columnMappings,
      recordMatching: {
        sourceColumnId: 'email',
        destinationColumnId: 'email',
      },
    };

    const result = await syncService.syncTableMapping(syncId, tableMapping, workbookId, actor);

    expect(result.recordsCreated).toBe(0);
    expect(result.recordsUpdated).toBe(2);
    expect(result.errors).toHaveLength(0);

    // Verify files were written to existing destination paths (not source paths)
    expect(writtenFiles).toHaveLength(2);
    const file1 = writtenFiles.find((f) => f.path === 'dest/item1.json');
    expect(file1).toBeDefined();
    const file1Content = JSON.parse(file1!.content) as Record<string, unknown>;
    expect(file1Content.name).toBe('John Updated');

    const file2 = writtenFiles.find((f) => f.path === 'dest/item2.json');
    expect(file2).toBeDefined();
  });

  it('should handle mixed create and update scenarios', async () => {
    const sourceFiles = [
      {
        folderId: sourceFolderId,
        path: 'src/file1.json',
        content: '{"id": "rec1", "email": "john@example.com", "name": "John"}',
      },
      {
        folderId: sourceFolderId,
        path: 'src/file2.json',
        content: '{"id": "rec2", "email": "jane@example.com", "name": "Jane"}',
      },
      {
        folderId: sourceFolderId,
        path: 'src/file3.json',
        content: '{"id": "rec3", "email": "bob@example.com", "name": "Bob"}',
      },
    ];

    // Only john exists in destination
    const destFiles = [
      {
        folderId: destFolderId,
        path: 'dest/john.json',
        content: '{"id": "dest1", "email": "john@example.com", "name": "John Old"}',
      },
    ];

    (dataFolderService.getAllFileContentsByFolderId as jest.Mock).mockImplementation((_workbookIdArg, folderIdArg) => {
      if (folderIdArg === sourceFolderId) {
        return Promise.resolve(sourceFiles);
      } else if (folderIdArg === destFolderId) {
        return Promise.resolve(destFiles);
      }
      return Promise.resolve([]);
    });

    const columnMappings: AnyColumnMapping[] = [
      { type: 'local', sourceColumnId: 'email', destinationColumnId: 'email' },
      { type: 'local', sourceColumnId: 'name', destinationColumnId: 'name' },
    ];

    const tableMapping: TableMapping = {
      sourceDataFolderId: sourceFolderId,
      destinationDataFolderId: destFolderId,
      columnMappings,
      recordMatching: {
        sourceColumnId: 'email',
        destinationColumnId: 'email',
      },
    };

    const result = await syncService.syncTableMapping(syncId, tableMapping, workbookId, actor);

    expect(result.recordsCreated).toBe(2); // jane and bob are new
    expect(result.recordsUpdated).toBe(1); // john is updated
    expect(result.errors).toHaveLength(0);
    expect(writtenFiles).toHaveLength(3);

    // Verify john's update uses existing destination path
    const johnFile = writtenFiles.find((f) => f.path === 'dest/john.json');
    expect(johnFile).toBeDefined();

    // Verify new files (jane, bob) use generated paths
    const newFiles = writtenFiles.filter((f) => f.path.startsWith('dest/pending-publish-'));
    expect(newFiles).toHaveLength(2);
  });

  it('should apply column mappings correctly (rename fields)', async () => {
    const sourceFiles = [
      {
        folderId: sourceFolderId,
        path: 'src/file1.json',
        content: '{"id": "rec1", "email": "john@example.com", "first_name": "John", "last_name": "Doe"}',
      },
    ];

    const destFiles: typeof sourceFiles = [];

    (dataFolderService.getAllFileContentsByFolderId as jest.Mock).mockImplementation((_workbookIdArg, folderIdArg) => {
      if (folderIdArg === sourceFolderId) {
        return Promise.resolve(sourceFiles);
      } else if (folderIdArg === destFolderId) {
        return Promise.resolve(destFiles);
      }
      return Promise.resolve([]);
    });

    // Map to different field names
    const columnMappings: AnyColumnMapping[] = [
      { type: 'local', sourceColumnId: 'email', destinationColumnId: 'contact_email' },
      { type: 'local', sourceColumnId: 'first_name', destinationColumnId: 'given_name' },
      { type: 'local', sourceColumnId: 'last_name', destinationColumnId: 'family_name' },
    ];

    const tableMapping: TableMapping = {
      sourceDataFolderId: sourceFolderId,
      destinationDataFolderId: destFolderId,
      columnMappings,
      recordMatching: {
        sourceColumnId: 'email',
        destinationColumnId: 'contact_email',
      },
    };

    const result = await syncService.syncTableMapping(syncId, tableMapping, workbookId, actor);

    expect(result.recordsCreated).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify field names were transformed
    expect(writtenFiles).toHaveLength(1);
    const file = writtenFiles[0];
    // New file should have a generated path
    expect(file.path.startsWith('dest/pending-publish-')).toBe(true);
    const fileContent = JSON.parse(file.content) as Record<string, unknown>;
    expect(fileContent.contact_email).toBe('john@example.com');
    expect(fileContent.given_name).toBe('John');
    expect(fileContent.family_name).toBe('Doe');
    // Original field names should not appear
    expect(fileContent.email).toBeUndefined();
    expect(fileContent.first_name).toBeUndefined();
    expect(fileContent.last_name).toBeUndefined();
  });

  it('should return error when batch write fails', async () => {
    const sourceFiles = [
      { folderId: sourceFolderId, path: 'src/file1.json', content: '{"id": "rec1", "email": "john@example.com"}' },
    ];

    const destFiles: typeof sourceFiles = [];

    (dataFolderService.getAllFileContentsByFolderId as jest.Mock).mockImplementation((_workbookIdArg, folderIdArg) => {
      if (folderIdArg === sourceFolderId) {
        return Promise.resolve(sourceFiles);
      } else if (folderIdArg === destFolderId) {
        return Promise.resolve(destFiles);
      }
      return Promise.resolve([]);
    });

    // Mock commitFilesToBranch to fail
    (scratchGitService.commitFilesToBranch as jest.Mock).mockRejectedValue(new Error('Git commit failed'));

    const columnMappings: AnyColumnMapping[] = [
      { type: 'local', sourceColumnId: 'email', destinationColumnId: 'email' },
    ];

    const tableMapping: TableMapping = {
      sourceDataFolderId: sourceFolderId,
      destinationDataFolderId: destFolderId,
      columnMappings,
      recordMatching: {
        sourceColumnId: 'email',
        destinationColumnId: 'email',
      },
    };

    const result = await syncService.syncTableMapping(syncId, tableMapping, workbookId, actor);

    // When batch write fails, counts should be reset and errors reported
    expect(result.recordsCreated).toBe(0);
    expect(result.recordsUpdated).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].error).toContain('Batch write failed');
  });

  it('should auto-inject match key field into new destination records', async () => {
    const sourceFiles = [
      {
        folderId: sourceFolderId,
        path: 'src/file1.json',
        content: '{"id": "rec1", "name": "John", "company": "Acme"}',
      },
    ];

    const destFiles: typeof sourceFiles = [];

    (dataFolderService.getAllFileContentsByFolderId as jest.Mock).mockImplementation((_workbookIdArg, folderIdArg) => {
      if (folderIdArg === sourceFolderId) {
        return Promise.resolve(sourceFiles);
      } else if (folderIdArg === destFolderId) {
        return Promise.resolve(destFiles);
      }
      return Promise.resolve([]);
    });

    // Column mappings do NOT include the match key field (id -> source_id)
    const columnMappings: AnyColumnMapping[] = [
      { type: 'local', sourceColumnId: 'name', destinationColumnId: 'full_name' },
      { type: 'local', sourceColumnId: 'company', destinationColumnId: 'company_name' },
    ];

    const tableMapping: TableMapping = {
      sourceDataFolderId: sourceFolderId,
      destinationDataFolderId: destFolderId,
      columnMappings,
      recordMatching: {
        sourceColumnId: 'id',
        destinationColumnId: 'source_id', // Not in columnMappings!
      },
    };

    const result = await syncService.syncTableMapping(syncId, tableMapping, workbookId, actor);

    expect(result.recordsCreated).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify the written file contains the auto-injected match key field
    expect(writtenFiles).toHaveLength(1);
    const fileContent = JSON.parse(writtenFiles[0].content) as Record<string, unknown>;

    // Match key should be auto-injected
    expect(fileContent.source_id).toBe('rec1');

    // Column-mapped fields should also be present
    expect(fileContent.full_name).toBe('John');
    expect(fileContent.company_name).toBe('Acme');
  });

  it('should not auto-inject match key if column mappings already populate it', async () => {
    const sourceFiles = [
      {
        folderId: sourceFolderId,
        path: 'src/file1.json',
        content: '{"id": "rec1", "external_id": "ext_999", "name": "John"}',
      },
    ];

    const destFiles: typeof sourceFiles = [];

    (dataFolderService.getAllFileContentsByFolderId as jest.Mock).mockImplementation((_workbookIdArg, folderIdArg) => {
      if (folderIdArg === sourceFolderId) {
        return Promise.resolve(sourceFiles);
      } else if (folderIdArg === destFolderId) {
        return Promise.resolve(destFiles);
      }
      return Promise.resolve([]);
    });

    // Column mappings explicitly map external_id to source_id (the match key field)
    const columnMappings: AnyColumnMapping[] = [
      { type: 'local', sourceColumnId: 'name', destinationColumnId: 'full_name' },
      { type: 'local', sourceColumnId: 'external_id', destinationColumnId: 'source_id' }, // User maps this!
    ];

    const tableMapping: TableMapping = {
      sourceDataFolderId: sourceFolderId,
      destinationDataFolderId: destFolderId,
      columnMappings,
      recordMatching: {
        sourceColumnId: 'id',
        destinationColumnId: 'source_id',
      },
    };

    const result = await syncService.syncTableMapping(syncId, tableMapping, workbookId, actor);

    expect(result.recordsCreated).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify the user's mapping took precedence (external_id value, not id value)
    expect(writtenFiles).toHaveLength(1);
    const fileContent = JSON.parse(writtenFiles[0].content) as Record<string, unknown>;

    // User mapping should win - source_id should be 'ext_999' not 'rec1'
    expect(fileContent.source_id).toBe('ext_999');
    expect(fileContent.full_name).toBe('John');
  });

  it('should return error when source record is missing match key field', async () => {
    const sourceFiles = [
      {
        folderId: sourceFolderId,
        path: 'src/file1.json',
        // Has 'id' (required for record parsing) but missing 'external_ref' (the match key)
        content: '{"id": "rec1", "name": "John", "company": "Acme"}',
      },
    ];

    const destFiles: typeof sourceFiles = [];

    (dataFolderService.getAllFileContentsByFolderId as jest.Mock).mockImplementation((_workbookIdArg, folderIdArg) => {
      if (folderIdArg === sourceFolderId) {
        return Promise.resolve(sourceFiles);
      } else if (folderIdArg === destFolderId) {
        return Promise.resolve(destFiles);
      }
      return Promise.resolve([]);
    });

    const columnMappings: AnyColumnMapping[] = [
      { type: 'local', sourceColumnId: 'name', destinationColumnId: 'full_name' },
    ];

    const tableMapping: TableMapping = {
      sourceDataFolderId: sourceFolderId,
      destinationDataFolderId: destFolderId,
      columnMappings,
      recordMatching: {
        sourceColumnId: 'external_ref', // This field doesn't exist in the source record
        destinationColumnId: 'source_id',
      },
    };

    const result = await syncService.syncTableMapping(syncId, tableMapping, workbookId, actor);

    // Record should fail, not be created
    expect(result.recordsCreated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('Source record missing match key field: external_ref');
  });
});
