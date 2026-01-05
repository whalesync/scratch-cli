/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */

import { createWorkbookId, FileId, WorkbookId } from '@spinner/shared-types';
import { Knex } from 'knex';
import {
  CONTENT_COLUMN,
  DELETED_COLUMN,
  DIRTY_COLUMN,
  FILE_ID_COLUMN,
  FILE_NAME_COLUMN,
  FileDbRecord,
  FILES_TABLE,
  FOLDER_ID_COLUMN,
  METADATA_COLUMN,
  ORIGINAL_COLUMN,
  PATH_COLUMN,
  REMOTE_ID_COLUMN,
  SUGGESTED_COLUMN,
  SUGGESTED_DELETE_COLUMN,
  WorkbookDb,
} from './workbook-db';

// Mock nanoid to ensure consistent file IDs in tests
jest.mock('nanoid', () => ({
  customAlphabet: () => {
    let counter = 0;
    return () => `testid${String(counter++).padStart(4, '0')}`;
  },
}));

// Mock the logger
jest.mock('src/logger', () => ({
  WSLogger: {
    error: jest.fn(),
  },
}));

describe('WorkbookDb', () => {
  let workbookDb: WorkbookDb;
  let mockKnex: jest.Mocked<Knex>;
  let mockQueryBuilder: any;
  let mockSchemaBuilder: any;
  let mockTableBuilder: any;
  let workbookId: WorkbookId;

  beforeEach(() => {
    workbookId = createWorkbookId();
    workbookDb = new WorkbookDb();

    // Create mock query builder with chainable methods
    mockQueryBuilder = {
      withSchema: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(1),
      delete: jest.fn().mockResolvedValue(1),
      orderBy: jest.fn().mockReturnThis(),
    };

    // Create mock table builder
    mockTableBuilder = {
      text: jest.fn().mockReturnThis(),
      primary: jest.fn().mockReturnThis(),
      nullable: jest.fn().mockReturnThis(),
      index: jest.fn().mockReturnThis(),
      unique: jest.fn().mockReturnThis(),
      jsonb: jest.fn().mockReturnThis(),
      timestamp: jest.fn().mockReturnThis(),
      boolean: jest.fn().mockReturnThis(),
      defaultTo: jest.fn().mockReturnThis(),
    };

    // Create mock schema builder
    mockSchemaBuilder = {
      withSchema: jest.fn().mockReturnThis(),
      hasTable: jest.fn().mockResolvedValue(false),
      createTable: jest.fn().mockImplementation((tableName, callback) => {
        callback(mockTableBuilder);
        return Promise.resolve();
      }),
    };

    // Create a transaction query builder (callable that returns query builder)
    const trxFn = jest.fn().mockReturnValue(mockQueryBuilder);
    // Add raw method to transaction
    Object.assign(trxFn, {
      raw: jest.fn().mockImplementation((sql) => sql),
    });

    // Create a function that acts as both a function and an object
    const knexFn = jest.fn().mockReturnValue(mockQueryBuilder);

    // Add properties to the function
    Object.assign(knexFn, {
      raw: jest.fn().mockImplementation((sql) => sql),
      schema: mockSchemaBuilder,
      fn: {
        now: jest.fn().mockReturnValue('CURRENT_TIMESTAMP'),
      },
      transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(trxFn);
      }),
    });

    mockKnex = knexFn as any;

    workbookDb.init(mockKnex);
  });

  describe('createFile', () => {
    const folderPath = '/test-folder';
    const fileName = 'test-file.md';
    const content = '---\ntitle: Test\n---\nTest content';

    it('should create a new file with content as content (not suggestion)', async () => {
      const mockFileRecord: FileDbRecord = {
        id: 'fil_testid0000' as FileId,
        remote_id: 'unpublished_fil_testid0000',
        folder_id: 'test-folder',
        path: '/test-folder/test-file.md',
        folder: 'test-folder',
        name: fileName,
        content,
        original: null,
        suggested: null,
        metadata: { title: 'Test' },
        created_at: new Date(),
        updated_at: new Date(),
        deleted: false,
        suggested_delete: false,
        dirty: true,
        errors: {},
        seen: false,
      };

      mockQueryBuilder.insert.mockResolvedValue(mockFileRecord);

      await workbookDb.createFile(workbookId, folderPath, fileName, content, false);

      expect(mockKnex).toHaveBeenCalledWith(FILES_TABLE);
      expect(mockQueryBuilder.withSchema).toHaveBeenCalledWith(workbookId);
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          [FILE_NAME_COLUMN]: fileName,
          [CONTENT_COLUMN]: content,
          [ORIGINAL_COLUMN]: null,
          [SUGGESTED_COLUMN]: null,
          [DIRTY_COLUMN]: true,
        }),
      );
    });

    it('should create a new file with content as suggestion', async () => {
      mockQueryBuilder.insert.mockResolvedValue({});

      await workbookDb.createFile(workbookId, folderPath, fileName, content, true);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          [FILE_NAME_COLUMN]: fileName,
          [CONTENT_COLUMN]: null,
          [ORIGINAL_COLUMN]: null,
          [SUGGESTED_COLUMN]: content,
        }),
      );
    });

    it('should extract metadata from frontmatter when creating non-suggestion file', async () => {
      const contentWithFrontmatter = '---\ntitle: My Title\nauthor: John\n---\nBody content';
      mockQueryBuilder.insert.mockResolvedValue({});

      await workbookDb.createFile(workbookId, folderPath, fileName, contentWithFrontmatter, false);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          [METADATA_COLUMN]: expect.objectContaining({
            title: 'My Title',
            author: 'John',
          }),
        }),
      );
    });

    it('should handle null content', async () => {
      mockQueryBuilder.insert.mockResolvedValue({});

      await workbookDb.createFile(workbookId, folderPath, fileName, null, false);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          [CONTENT_COLUMN]: null,
          [METADATA_COLUMN]: {},
        }),
      );
    });

    it('should throw error for invalid folder path', async () => {
      await expect(workbookDb.createFile(workbookId, 'invalid-path', fileName, content, false)).rejects.toThrow(
        'Path must start with a slash',
      );
    });
  });

  describe('deleteFileById', () => {
    const fileId = 'fil_1234567890' as FileId;

    it('should set suggested delete flag when deleting as suggestion', async () => {
      await workbookDb.deleteFileById(workbookId, fileId, true);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          [SUGGESTED_COLUMN]: '',
          [SUGGESTED_DELETE_COLUMN]: true,
        }),
      );
    });

    it('should flag for deletion when file has original content', async () => {
      mockQueryBuilder.first.mockResolvedValue({ [ORIGINAL_COLUMN]: 'original content' });

      await workbookDb.deleteFileById(workbookId, fileId, false);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          [DELETED_COLUMN]: true,
          [DIRTY_COLUMN]: true,
        }),
      );
    });

    it('should hard delete when file has no original content', async () => {
      mockQueryBuilder.first.mockResolvedValue({ [ORIGINAL_COLUMN]: null });

      await workbookDb.deleteFileById(workbookId, fileId, false);

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });
  });

  describe('updateFile', () => {
    const fileId = 'fil_1234567890' as FileId;
    const newContent = '---\ntitle: Updated\n---\nUpdated content';

    it('should update content and metadata for non-suggestion update', async () => {
      await workbookDb.updateFile(workbookId, fileId, newContent, false);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          [CONTENT_COLUMN]: newContent,
          [METADATA_COLUMN]: expect.objectContaining({ title: 'Updated' }),
          [DIRTY_COLUMN]: true,
        }),
      );
    });

    it('should update suggested column for suggestion update', async () => {
      await workbookDb.updateFile(workbookId, fileId, newContent, true);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          [SUGGESTED_COLUMN]: newContent,
        }),
      );
      expect(mockQueryBuilder.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          [CONTENT_COLUMN]: expect.anything(),
        }),
      );
    });

    it('should handle null content for non-suggestion update', async () => {
      await workbookDb.updateFile(workbookId, fileId, null, false);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          [CONTENT_COLUMN]: null,
          [METADATA_COLUMN]: {},
        }),
      );
    });

    it('should handle malformed frontmatter gracefully', async () => {
      const malformedContent = '---\ninvalid: yaml: content:\n---\nBody';

      await workbookDb.updateFile(workbookId, fileId, malformedContent, false);

      // Should still update even if metadata parsing fails
      expect(mockQueryBuilder.update).toHaveBeenCalled();
    });
  });

  describe('upsertFilesFromConnectorRecords', () => {
    const folderPath = '/test-folder';
    const mockRecords = [
      {
        id: 'record1',
        fields: {
          col1: 'Test Record 1', // Using wsId from columns
          col2: 'Body content 1',
          col3: 'John Doe',
        },
        errors: null,
      },
      {
        id: 'record2',
        fields: {
          col1: 'Test Record 2',
          col2: 'Body content 2',
          col3: 'Jane Doe',
        },
        errors: null,
      },
    ];

    const mockTableSpec = {
      id: { wsId: 'table1' },
      name: 'Test Table',
      columns: [
        { id: { wsId: 'col1', remoteId: ['title'] }, name: 'Title', type: 'text' as const },
        { id: { wsId: 'col2', remoteId: ['content'] }, name: 'Content', type: 'text' as const },
        { id: { wsId: 'col3', remoteId: ['author'] }, name: 'Author', type: 'text' as const },
      ],
      titleColumnRemoteId: ['title'],
      mainContentColumnRemoteId: ['content'],
    };

    it('should insert new files from connector records', async () => {
      // Mock transaction to simulate no existing files
      mockQueryBuilder.first.mockResolvedValue(null);

      await workbookDb.upsertFilesFromConnectorRecords(workbookId, folderPath, mockRecords, mockTableSpec);

      expect(mockKnex).toHaveProperty('transaction');
      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(2);
    });

    it('should update existing files from connector records', async () => {
      const existingFile = {
        [FILE_ID_COLUMN]: 'fil_existing',
        [REMOTE_ID_COLUMN]: 'record1',
        [FOLDER_ID_COLUMN]: 'test-folder',
      };

      // Mock: first check path (null), then check remote_id (existing), repeat for record 2
      mockQueryBuilder.first
        .mockResolvedValueOnce(null) // Check path for record1
        .mockResolvedValueOnce(existingFile) // Check remote_id for record1 - found
        .mockResolvedValueOnce(null) // Check path for record2
        .mockResolvedValueOnce(null); // Check remote_id for record2 - not found

      await workbookDb.upsertFilesFromConnectorRecords(workbookId, folderPath, mockRecords, mockTableSpec);

      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });

    it('should handle duplicate file names by adding suffix', async () => {
      const singleRecord = [mockRecords[0]];

      // Mock scenario where first file name is taken, second is available
      mockQueryBuilder.first
        .mockResolvedValueOnce({ path: '/test-folder/test-record-1.md' }) // First path attempt - taken
        .mockResolvedValueOnce(null) // Second path attempt - available
        .mockResolvedValueOnce(null); // Check for existing remote_id - not found

      await workbookDb.upsertFilesFromConnectorRecords(workbookId, folderPath, singleRecord, mockTableSpec);

      expect(mockQueryBuilder.first).toHaveBeenCalled();
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });
  });

  describe('getFileById', () => {
    const fileId = 'fil_1234567890' as FileId;

    it('should return file record when found', async () => {
      const mockFile: FileDbRecord = {
        id: fileId,
        remote_id: 'remote1',
        folder_id: 'folder1',
        path: '/folder1/file.md',
        folder: 'folder1',
        name: 'file.md',
        content: 'content',
        original: null,
        suggested: null,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
        deleted: false,
        suggested_delete: false,
        dirty: false,
        errors: {},
        seen: false,
      };

      mockQueryBuilder.first.mockResolvedValue(mockFile);

      const result = await workbookDb.getFileById(workbookId, fileId);

      expect(result).toEqual(mockFile);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(FILE_ID_COLUMN, fileId);
    });

    it('should return null when file not found', async () => {
      mockQueryBuilder.first.mockResolvedValue(undefined);

      const result = await workbookDb.getFileById(workbookId, fileId);

      expect(result).toBeNull();
    });
  });

  describe('getFileByPath', () => {
    const filePath = '/folder1/file.md';

    it('should return file record when found by path', async () => {
      const mockFile: Partial<FileDbRecord> = {
        id: 'fil_1234567890' as FileId,
        path: filePath,
      };

      mockQueryBuilder.first.mockResolvedValue(mockFile);

      const result = await workbookDb.getFileByPath(workbookId, filePath);

      expect(result).toEqual(mockFile);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(PATH_COLUMN, filePath);
    });

    it('should return null when file not found', async () => {
      mockQueryBuilder.first.mockResolvedValue(undefined);

      const result = await workbookDb.getFileByPath(workbookId, filePath);

      expect(result).toBeNull();
    });
  });

  describe('getFilesByIds', () => {
    it('should return multiple files by IDs', async () => {
      const fileIds = ['fil_1234567890' as FileId, 'fil_0987654321' as FileId];
      const mockFiles: Partial<FileDbRecord>[] = [
        { id: fileIds[0], name: 'file1.md' },
        { id: fileIds[1], name: 'file2.md' },
      ];

      mockQueryBuilder.select.mockResolvedValue(mockFiles);

      const result = await workbookDb.getFilesByIds(workbookId, fileIds);

      expect(result).toEqual(mockFiles);
      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith(FILE_ID_COLUMN, fileIds);
    });

    it('should return empty array when no IDs provided', async () => {
      const result = await workbookDb.getFilesByIds(workbookId, []);

      expect(result).toEqual([]);
      expect(mockQueryBuilder.whereIn).not.toHaveBeenCalled();
    });
  });

  describe('acceptSuggestionByPath', () => {
    const filePath = '/folder1/file.md';

    it('should copy suggested content to content column', async () => {
      const mockFile: Partial<FileDbRecord> = {
        id: 'fil_1234567890' as FileId,
        suggested: '---\ntitle: New\n---\nSuggested content',
        suggested_delete: false,
      };

      mockQueryBuilder.first.mockResolvedValue(mockFile);
      mockQueryBuilder.update.mockResolvedValue(1);

      const result = await workbookDb.acceptSuggestionByPath(workbookId, filePath);

      expect(result).toBe(1);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          [SUGGESTED_COLUMN]: null,
          [DIRTY_COLUMN]: true,
        }),
      );
    });

    it('should delete file when accepting suggested delete', async () => {
      const mockFile: Partial<FileDbRecord> = {
        id: 'fil_1234567890' as FileId,
        suggested: null,
        suggested_delete: true,
        original: 'original content',
      };

      mockQueryBuilder.first.mockResolvedValue(mockFile);

      const result = await workbookDb.acceptSuggestionByPath(workbookId, filePath);

      expect(result).toBe(1);
    });

    it('should return 0 when no suggestion exists', async () => {
      const mockFile: Partial<FileDbRecord> = {
        id: 'fil_1234567890' as FileId,
        suggested: null,
        suggested_delete: false,
      };

      mockQueryBuilder.first.mockResolvedValue(mockFile);

      const result = await workbookDb.acceptSuggestionByPath(workbookId, filePath);

      expect(result).toBe(0);
    });

    it('should throw FileNotFoundError when file does not exist', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      await expect(workbookDb.acceptSuggestionByPath(workbookId, filePath)).rejects.toThrow('File not found');
    });
  });

  describe('rejectSuggestionByPath', () => {
    const filePath = '/folder1/file.md';

    it('should clear suggestion and suggested_delete flag', async () => {
      mockQueryBuilder.update.mockResolvedValue(1);

      const result = await workbookDb.rejectSuggestionByPath(workbookId, filePath);

      expect(result).toBe(1);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        [SUGGESTED_COLUMN]: null,
        [SUGGESTED_DELETE_COLUMN]: false,
      });
      expect(mockQueryBuilder.whereNotNull).toHaveBeenCalledWith(SUGGESTED_COLUMN);
    });
  });

  describe('undeleteFileByPath', () => {
    const filePath = '/folder1/file.md';

    it('should clear the deleted flag', async () => {
      await workbookDb.undeleteFileByPath(workbookId, filePath);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        [DELETED_COLUMN]: false,
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(PATH_COLUMN, filePath);
    });
  });

  describe('deleteFolderContents', () => {
    const folderPath = '/test-folder';

    it('should delete all files in folder', async () => {
      mockQueryBuilder.delete.mockResolvedValue(5);

      await workbookDb.deleteFolderContents(workbookId, folderPath);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(FOLDER_ID_COLUMN, 'test-folder');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });
  });

  describe('createForWorkbook', () => {
    it('should create schema and files table', async () => {
      await workbookDb.createForWorkbook(workbookId);

      expect(mockKnex.raw).toHaveBeenCalledWith(`CREATE SCHEMA IF NOT EXISTS "${workbookId}"`);
      expect(mockSchemaBuilder.withSchema).toHaveBeenCalledWith(workbookId);
      expect(mockSchemaBuilder.hasTable).toHaveBeenCalledWith(FILES_TABLE);
      expect(mockSchemaBuilder.createTable).toHaveBeenCalledWith(FILES_TABLE, expect.any(Function));
    });

    it('should not create table if it already exists', async () => {
      mockSchemaBuilder.hasTable.mockResolvedValue(true);

      await workbookDb.createForWorkbook(workbookId);

      expect(mockSchemaBuilder.createTable).not.toHaveBeenCalled();
    });
  });

  describe('listFilesAndFolders', () => {
    const parentFolderPath = '/parent-folder';

    it('should list all files under parent folder', async () => {
      const mockFiles: Partial<FileDbRecord>[] = [
        { id: 'fil_1' as FileId, path: '/parent-folder/file1.md' },
        { id: 'fil_2' as FileId, path: '/parent-folder/subfolder/file2.md' },
      ];

      mockQueryBuilder.select.mockResolvedValue(mockFiles);

      const result = await workbookDb.listFilesAndFolders(workbookId, parentFolderPath);

      expect(result).toEqual(mockFiles);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(PATH_COLUMN, 'like', `${parentFolderPath}%`);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(PATH_COLUMN, 'asc');
    });

    it('should throw error for invalid folder path', async () => {
      await expect(workbookDb.listFilesAndFolders(workbookId, 'invalid-path')).rejects.toThrow(
        'Path must start with a slash',
      );
    });
  });

  describe('resetSeenFlagForFolder', () => {
    const folderPath = '/test-folder';

    it('should reset seen flag for all files in folder', async () => {
      await workbookDb.resetSeenFlagForFolder(workbookId, folderPath);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(FOLDER_ID_COLUMN, 'test-folder');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ seen: false }));
    });
  });
});
