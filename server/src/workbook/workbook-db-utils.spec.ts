import { ConnectorRecord } from '../remote-service/connectors/types';
import {
  convertConnectorRecordToFrontMatter,
  extractFileName,
  extractFolderId,
  extractFolderPath,
  slugifyFileName,
} from './workbook-db';

describe('WorkbookDb Utility Functions', () => {
  describe('extractFolderId', () => {
    it('should extract folder ID from folder path', () => {
      const folderPath = '/parent/child/target-folder';
      const result = extractFolderId(folderPath);

      expect(result).toBe('target-folder');
    });

    it('should extract folder ID from file path', () => {
      const filePath = '/parent/child/target-folder/file.md';
      const result = extractFolderId(filePath);

      expect(result).toBe('target-folder');
    });

    it('should handle root-level folder', () => {
      const folderPath = '/root-folder';
      const result = extractFolderId(folderPath);

      expect(result).toBe('root-folder');
    });

    it('should handle root-level file', () => {
      const filePath = '/root-folder/file.md';
      const result = extractFolderId(filePath);

      expect(result).toBe('root-folder');
    });

    it('should handle paths with multiple dots', () => {
      const filePath = '/folder/subfolder/file.test.md';
      const result = extractFolderId(filePath);

      expect(result).toBe('subfolder');
    });

    it('should handle folder path ending with slash', () => {
      const folderPath = '/parent/child/target-folder/';
      const result = extractFolderId(folderPath);

      // path.posix.parse handles trailing slash by treating it as dir
      expect(result).toBe('target-folder');
    });
  });

  describe('extractFolderPath', () => {
    it('should extract folder path from file path', () => {
      const filePath = '/parent/child/folder/file.md';
      const result = extractFolderPath(filePath);

      expect(result).toBe('/parent/child/folder');
    });

    it('should return same path for folder path without file', () => {
      const folderPath = '/parent/child/folder';
      const result = extractFolderPath(folderPath);

      expect(result).toBe('/parent/child/folder');
    });

    it('should handle root-level file', () => {
      const filePath = '/folder/file.md';
      const result = extractFolderPath(filePath);

      expect(result).toBe('/folder');
    });

    it('should handle nested folders', () => {
      const filePath = '/a/b/c/d/e/file.txt';
      const result = extractFolderPath(filePath);

      expect(result).toBe('/a/b/c/d/e');
    });

    it('should handle paths with no file extension', () => {
      const folderPath = '/parent/child';
      const result = extractFolderPath(folderPath);

      expect(result).toBe('/parent/child');
    });

    it('should handle file with multiple dots in extension', () => {
      const filePath = '/folder/file.test.spec.ts';
      const result = extractFolderPath(filePath);

      expect(result).toBe('/folder');
    });
  });

  describe('extractFileName', () => {
    it('should extract file name with extension from path', () => {
      const filePath = '/folder/subfolder/document.md';
      const result = extractFileName(filePath);

      expect(result).toBe('document.md');
    });

    it('should return empty string for folder path', () => {
      const folderPath = '/folder/subfolder';
      const result = extractFileName(folderPath);

      expect(result).toBe('');
    });

    it('should handle file at root level', () => {
      const filePath = '/folder/file.txt';
      const result = extractFileName(filePath);

      expect(result).toBe('file.txt');
    });

    it('should handle files with multiple dots', () => {
      const filePath = '/folder/my.test.file.md';
      const result = extractFileName(filePath);

      expect(result).toBe('my.test.file.md');
    });

    it('should handle files with no extension', () => {
      const folderPath = '/folder/filename';
      const result = extractFileName(folderPath);

      expect(result).toBe('');
    });

    it('should handle hidden files', () => {
      const filePath = '/folder/.gitignore';
      const result = extractFileName(filePath);

      // Hidden files are treated as having no extension by path.posix.parse
      // so extractFileName returns empty string
      expect(result).toBe('');
    });

    it('should handle complex file names', () => {
      const filePath = '/folder/My Document (2024).final.v2.md';
      const result = extractFileName(filePath);

      expect(result).toBe('My Document (2024).final.v2.md');
    });
  });

  describe('slugifyFileName', () => {
    it('should convert spaces to hyphens', () => {
      const result = slugifyFileName('My File Name');

      expect(result).toBe('my-file-name');
    });

    it('should convert to lowercase', () => {
      const result = slugifyFileName('UPPERCASE TEXT');

      expect(result).toBe('uppercase-text');
    });

    it('should remove special characters', () => {
      const result = slugifyFileName('File@#$%Name!');

      expect(result).toBe('filename');
    });

    it('should handle accented characters', () => {
      const result = slugifyFileName('Café Résumé');

      expect(result).toBe('cafe-resume');
    });

    it('should replace multiple spaces with single hyphen', () => {
      const result = slugifyFileName('Multiple   Spaces   Here');

      expect(result).toBe('multiple-spaces-here');
    });

    it('should replace multiple hyphens with single hyphen', () => {
      const result = slugifyFileName('Too---Many---Hyphens');

      expect(result).toBe('too-many-hyphens');
    });

    it('should trim leading and trailing whitespace', () => {
      const result = slugifyFileName('  Trimmed Text  ');

      expect(result).toBe('trimmed-text');
    });

    it('should handle unicode characters', () => {
      const result = slugifyFileName('Hello 世界');

      // Unicode characters are removed but trailing hyphen from space remains
      expect(result).toBe('hello-');
    });

    it('should preserve numbers', () => {
      const result = slugifyFileName('File 123 Name 456');

      expect(result).toBe('file-123-name-456');
    });

    it('should handle already slugified text', () => {
      const result = slugifyFileName('already-slugified');

      expect(result).toBe('already-slugified');
    });

    it('should handle empty string', () => {
      const result = slugifyFileName('');

      expect(result).toBe('');
    });

    it('should handle text with only special characters', () => {
      const result = slugifyFileName('!@#$%^&*()');

      expect(result).toBe('');
    });

    it('should handle mixed alphanumeric with special chars', () => {
      const result = slugifyFileName('Test (2024) - Final [v2]');

      expect(result).toBe('test-2024-final-v2');
    });
  });

  describe('convertConnectorRecordToFrontMatter', () => {
    it('should convert record with main content column to front matter', () => {
      const record: ConnectorRecord = {
        id: 'record1',
        fields: {
          title: 'Test Title',
          body: 'This is the main content',
          author: 'John Doe',
          date: '2024-01-01',
        },
        errors: null,
      };

      const tableSpec = {
        id: { wsId: 'table1' },
        name: 'Test Table',
        columns: [
          { id: { wsId: 'col1', remoteId: 'title' }, name: 'Title', type: 'text' as const },
          { id: { wsId: 'col2', remoteId: 'body' }, name: 'Body', type: 'text' as const },
          { id: { wsId: 'col3', remoteId: 'author' }, name: 'Author', type: 'text' as const },
          { id: { wsId: 'col4', remoteId: 'date' }, name: 'Date', type: 'text' as const },
        ],
        titleColumnRemoteId: ['title'],
        mainContentColumnRemoteId: ['body'],
      };

      const result = convertConnectorRecordToFrontMatter(record, tableSpec);

      expect(result.content).toContain('This is the main content');
      expect(result.content).toContain('title: Test Title');
      expect(result.content).toContain('author: John Doe');
      expect(result.content).toContain("date: '2024-01-01'");
      expect(result.metadata).toEqual({
        title: 'Test Title',
        author: 'John Doe',
        date: '2024-01-01',
      });
    });

    it('should handle record with no main content column', () => {
      const record: ConnectorRecord = {
        id: 'record2',
        fields: {
          title: 'Test Title',
          description: 'A description',
        },
        errors: null,
      };

      const tableSpec = {
        id: { wsId: 'table1' },
        name: 'Test Table',
        columns: [
          { id: { wsId: 'col1', remoteId: 'title' }, name: 'Title', type: 'text' as const },
          { id: { wsId: 'col2', remoteId: 'description' }, name: 'Description', type: 'text' as const },
        ],
        titleColumnRemoteId: ['title'],
        mainContentColumnRemoteId: undefined,
      };

      const result = convertConnectorRecordToFrontMatter(record, tableSpec);

      expect(result.content).toContain('title: Test Title');
      expect(result.content).toContain('description: A description');
      expect(result.metadata).toEqual({
        title: 'Test Title',
        description: 'A description',
      });
    });

    it('should handle null values in fields', () => {
      const record: ConnectorRecord = {
        id: 'record3',
        fields: {
          title: 'Test',
          body: null,
          // Don't include undefined as it causes YAML serialization errors
        },
        errors: null,
      };

      const tableSpec = {
        id: { wsId: 'table1' },
        name: 'Test Table',
        columns: [
          { id: { wsId: 'col1', remoteId: 'title' }, name: 'Title', type: 'text' as const },
          { id: { wsId: 'col2', remoteId: 'body' }, name: 'Body', type: 'text' as const },
        ],
        mainContentColumnRemoteId: ['body'],
      };

      const result = convertConnectorRecordToFrontMatter(record, tableSpec);

      expect(result.content).toBeDefined();
      expect(result.metadata.title).toBe('Test');
    });

    it('should handle non-string values in main content', () => {
      const record: ConnectorRecord = {
        id: 'record4',
        fields: {
          title: 'Test',
          body: { complex: 'object', with: { nested: 'data' } },
        },
        errors: null,
      };

      const tableSpec = {
        id: { wsId: 'table1' },
        name: 'Test Table',
        columns: [
          { id: { wsId: 'col1', remoteId: 'title' }, name: 'Title', type: 'text' as const },
          { id: { wsId: 'col2', remoteId: 'body' }, name: 'Body', type: 'text' as const },
        ],
        mainContentColumnRemoteId: ['body'],
      };

      const result = convertConnectorRecordToFrontMatter(record, tableSpec);

      expect(result.content).toContain('"complex": "object"');
      expect(result.content).toContain('"nested": "data"');
    });

    it('should handle array values in metadata', () => {
      const record: ConnectorRecord = {
        id: 'record5',
        fields: {
          title: 'Test',
          tags: ['tag1', 'tag2', 'tag3'],
          body: 'Content here',
        },
        errors: null,
      };

      const tableSpec = {
        id: { wsId: 'table1' },
        name: 'Test Table',
        columns: [
          { id: { wsId: 'col1', remoteId: 'title' }, name: 'Title', type: 'text' as const },
          { id: { wsId: 'col2', remoteId: 'tags' }, name: 'Tags', type: 'text' as const },
          { id: { wsId: 'col3', remoteId: 'body' }, name: 'Body', type: 'text' as const },
        ],
        mainContentColumnRemoteId: ['body'],
      };

      const result = convertConnectorRecordToFrontMatter(record, tableSpec);

      expect(result.metadata.tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(result.content).toContain('Content here');
    });

    it('should handle numeric values', () => {
      const record: ConnectorRecord = {
        id: 'record6',
        fields: {
          title: 'Test',
          count: 42,
          price: 19.99,
          body: 'Content',
        },
        errors: null,
      };

      const tableSpec = {
        id: { wsId: 'table1' },
        name: 'Test Table',
        columns: [
          { id: { wsId: 'col1', remoteId: 'title' }, name: 'Title', type: 'text' as const },
          { id: { wsId: 'col2', remoteId: 'count' }, name: 'Count', type: 'number' as const },
          { id: { wsId: 'col3', remoteId: 'price' }, name: 'Price', type: 'number' as const },
          { id: { wsId: 'col4', remoteId: 'body' }, name: 'Body', type: 'text' as const },
        ],
        mainContentColumnRemoteId: ['body'],
      };

      const result = convertConnectorRecordToFrontMatter(record, tableSpec);

      expect(result.metadata.count).toBe(42);
      expect(result.metadata.price).toBe(19.99);
    });

    it('should handle boolean values', () => {
      const record: ConnectorRecord = {
        id: 'record7',
        fields: {
          title: 'Test',
          published: true,
          featured: false,
          body: 'Content',
        },
        errors: null,
      };

      const tableSpec = {
        id: { wsId: 'table1' },
        name: 'Test Table',
        columns: [
          { id: { wsId: 'col1', remoteId: 'title' }, name: 'Title', type: 'text' as const },
          { id: { wsId: 'col2', remoteId: 'published' }, name: 'Published', type: 'checkbox' as const },
          { id: { wsId: 'col3', remoteId: 'featured' }, name: 'Featured', type: 'checkbox' as const },
          { id: { wsId: 'col4', remoteId: 'body' }, name: 'Body', type: 'text' as const },
        ],
        mainContentColumnRemoteId: ['body'],
      };

      const result = convertConnectorRecordToFrontMatter(record, tableSpec);

      expect(result.metadata.published).toBe(true);
      expect(result.metadata.featured).toBe(false);
    });

    it('should handle empty record fields', () => {
      const record: ConnectorRecord = {
        id: 'record8',
        fields: {},
        errors: null,
      };

      const tableSpec = {
        id: { wsId: 'table1' },
        name: 'Test Table',
        columns: [],
        mainContentColumnRemoteId: undefined,
      };

      const result = convertConnectorRecordToFrontMatter(record, tableSpec);

      expect(result.content).toBeDefined();
      expect(result.metadata).toEqual({});
    });

    it('should separate body content from metadata correctly', () => {
      const record: ConnectorRecord = {
        id: 'record9',
        fields: {
          title: 'My Article',
          author: 'Jane Smith',
          body: 'This is the article body.\n\nIt has multiple paragraphs.',
          category: 'Technology',
        },
        errors: null,
      };

      const tableSpec = {
        id: { wsId: 'table1' },
        name: 'Test Table',
        columns: [
          { id: { wsId: 'col1', remoteId: 'title' }, name: 'Title', type: 'text' as const },
          { id: { wsId: 'col2', remoteId: 'author' }, name: 'Author', type: 'text' as const },
          { id: { wsId: 'col3', remoteId: 'body' }, name: 'Body', type: 'text' as const },
          { id: { wsId: 'col4', remoteId: 'category' }, name: 'Category', type: 'text' as const },
        ],
        mainContentColumnRemoteId: ['body'],
      };

      const result = convertConnectorRecordToFrontMatter(record, tableSpec);

      // Body should be in the content, not metadata
      expect(result.content).toContain('This is the article body');
      expect(result.content).toContain('It has multiple paragraphs');

      // Metadata should not include body
      expect(result.metadata.body).toBeUndefined();

      // Metadata should include other fields
      expect(result.metadata.title).toBe('My Article');
      expect(result.metadata.author).toBe('Jane Smith');
      expect(result.metadata.category).toBe('Technology');
    });
  });
});
