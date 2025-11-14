/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Service } from '@prisma/client';
import { ConnectorRecord, PostgresColumnType } from '../../types';
import { WordPressTableSpec } from '../custom-spec-registry';
import { WordPressConnector } from './wordpress-connector';
import { WORDPRESS_POLLING_PAGE_SIZE } from './wordpress-constants';
import { WordPressDataType } from './wordpress-types';

// Mock the WordPressHttpClient
jest.mock('./wordpress-http-client', () => {
  return {
    WordPressHttpClient: jest.fn().mockImplementation(() => ({
      pollRecords: jest.fn(),
      testEndpoint: jest.fn(),
      getTypes: jest.fn(),
      getEndpointOptions: jest.fn(),
      createRecord: jest.fn(),
      updateRecord: jest.fn(),
      deleteRecord: jest.fn(),
    })),
  };
});

// Mock turndown
jest.mock('turndown', () =>
  jest.fn().mockImplementation(() => ({
    turndown: jest.fn((html: string) => html.replace(/<[^>]*>/g, '').trim()),
  })),
);

// Mock client type
type MockWordPressClient = {
  pollRecords: jest.Mock;
  testEndpoint: jest.Mock;
  getTypes: jest.Mock;
  getEndpointOptions: jest.Mock;
  createRecord: jest.Mock;
  updateRecord: jest.Mock;
  deleteRecord: jest.Mock;
};

describe('WordPressConnector', () => {
  let connector: WordPressConnector;
  let mockClient: MockWordPressClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create connector and get reference to the mocked client
    connector = new WordPressConnector('testuser', 'testpass', 'https://example.com/wp-json');

    // Get the mocked client instance
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { WordPressHttpClient } = require('./wordpress-http-client');
    mockClient = WordPressHttpClient.mock.results[WordPressHttpClient.mock.results.length - 1]
      .value as MockWordPressClient;
  });

  describe('downloadTableRecords', () => {
    it('should download records and transform basic fields', async () => {
      // Minimal table spec with just title field
      const mockTableSpec: WordPressTableSpec = {
        id: { wsId: 'posts', remoteId: ['posts'] },
        name: 'Posts',
        columns: [
          {
            id: { wsId: 'title', remoteId: ['title'] },
            name: 'Title',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.RENDERED,
          },
        ],
      };

      // Mock WordPress API response
      mockClient.pollRecords.mockResolvedValue([
        {
          id: 1,
          title: {
            rendered: '<h1>Test Post</h1>',
          },
        },
        {
          id: 2,
          title: {
            rendered: '<h1>Another Post</h1>',
          },
        },
      ]);

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, {}, callback);

      expect(mockClient.pollRecords).toHaveBeenCalledTimes(1);
      expect(mockClient.pollRecords).toHaveBeenCalledWith('posts', 0, WORDPRESS_POLLING_PAGE_SIZE);

      expect(callback).toHaveBeenCalledTimes(1);

      const records = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records;
      expect(records).toHaveLength(2);
      expect(records[0].id).toBe('1');
      expect(records[0].fields.title).toBe('Test Post'); // HTML stripped by turndown mock
      expect(records[1].id).toBe('2');
      expect(records[1].fields.title).toBe('Another Post');
    });

    it('should handle pagination correctly', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: { wsId: 'posts', remoteId: ['posts'] },
        name: 'Posts',
        columns: [
          {
            id: { wsId: 'title', remoteId: ['title'] },
            name: 'Title',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.RENDERED,
          },
        ],
      };

      // Note: WordPress pagination triggers when returned count < WORDPRESS_POLLING_PAGE_SIZE (100)
      // So we need to return fewer items to simulate the end of pagination
      mockClient.pollRecords.mockResolvedValue([
        { id: 1, title: { rendered: '<h1>Post 1</h1>' } },
        { id: 2, title: { rendered: '<h1>Post 2</h1>' } },
      ]);

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, {}, callback);

      // Since we returned only 2 items (< 100), pagination stops after one call
      expect(mockClient.pollRecords).toHaveBeenCalledTimes(1);
      expect(mockClient.pollRecords).toHaveBeenCalledWith('posts', 0, WORDPRESS_POLLING_PAGE_SIZE);

      // Verify callback was called once with all records
      expect(callback).toHaveBeenCalledTimes(1);

      expect((callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records).toHaveLength(2);

      const callbackArg = callback.mock.calls[0][0] as { connectorProgress?: { nextOffset: number | undefined } };
      // Should indicate no more pages
      expect(callbackArg.connectorProgress?.nextOffset).toBeUndefined();
    });

    it('should handle rendered content conversion to markdown by default', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: { wsId: 'posts', remoteId: ['posts'] },
        name: 'Posts',
        columns: [
          {
            id: { wsId: 'content', remoteId: ['content'] },
            name: 'Content',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.RENDERED,
          },
        ],
      };

      mockClient.pollRecords.mockResolvedValue([
        {
          id: 1,
          content: {
            rendered: '<h1>Heading</h1><p>Paragraph content</p>',
          },
        },
      ]);

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, {}, callback);

      const record = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records[0];
      // Should be converted to markdown (HTML tags stripped by mock)
      expect(record.fields.content).toBe('HeadingParagraph content');
    });

    it('should keep rendered content as HTML when dataConverter is html', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: { wsId: 'posts', remoteId: ['posts'] },
        name: 'Posts',
        columns: [
          {
            id: { wsId: 'content', remoteId: ['content'] },
            name: 'Content',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.RENDERED,
          },
        ],
      };

      mockClient.pollRecords.mockResolvedValue([
        {
          id: 1,
          content: {
            rendered: '<h1>Heading</h1><p>Content</p>',
          },
        },
      ]);

      const columnSettingsMapWithHtml = {
        content: {
          dataConverter: 'html',
        },
      };

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, columnSettingsMapWithHtml, callback);

      const record = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records[0];
      // Should keep HTML as-is
      expect(record.fields.content).toBe('<h1>Heading</h1><p>Content</p>');
    });

    it('should handle non-rendered fields', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: { wsId: 'posts', remoteId: ['posts'] },
        name: 'Posts',
        columns: [
          {
            id: { wsId: 'status', remoteId: ['status'] },
            name: 'Status',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.STRING,
          },
          {
            id: { wsId: 'sticky', remoteId: ['sticky'] },
            name: 'Sticky',
            pgType: PostgresColumnType.BOOLEAN,
            wordpressDataType: WordPressDataType.BOOLEAN,
          },
        ],
      };

      mockClient.pollRecords.mockResolvedValue([
        {
          id: 1,
          status: 'publish',
          sticky: true,
        },
      ]);

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, {}, callback);

      const record = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records[0];
      expect(record.fields.status).toBe('publish');
      expect(record.fields.sticky).toBe(true);
    });

    it('should handle progress parameter for resuming downloads', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: { wsId: 'posts', remoteId: ['posts'] },
        name: 'Posts',
        columns: [
          {
            id: { wsId: 'title', remoteId: ['title'] },
            name: 'Title',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.RENDERED,
          },
        ],
      };

      mockClient.pollRecords.mockResolvedValue([
        {
          id: 50,
          title: { rendered: '<h1>Post 50</h1>' },
        },
      ]);

      const callback = jest.fn().mockResolvedValue(undefined);
      const progress = { nextOffset: 49 };

      await connector.downloadTableRecords(mockTableSpec, {}, callback, progress);

      // Should use the progress offset
      expect(mockClient.pollRecords).toHaveBeenCalledWith('posts', 49, WORDPRESS_POLLING_PAGE_SIZE);
    });

    it('should return connector progress with next offset', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: { wsId: 'posts', remoteId: ['posts'] },
        name: 'Posts',
        columns: [
          {
            id: { wsId: 'title', remoteId: ['title'] },
            name: 'Title',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.RENDERED,
          },
        ],
      };

      // Return exactly page size items to simulate more data available
      const fullBatch = [
        { id: 1, title: { rendered: '<h1>Post 1</h1>' } },
        { id: 2, title: { rendered: '<h1>Post 2</h1>' } },
      ];

      mockClient.pollRecords.mockResolvedValue(fullBatch);

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, {}, callback);

      const callbackArg = callback.mock.calls[0][0] as { connectorProgress?: { nextOffset: number } };
      // With 2 items returned and page size being greater, should indicate no more pages
      expect(callbackArg.connectorProgress?.nextOffset).toBeUndefined();
    });
  });

  describe('displayName', () => {
    it('should return WordPress as display name', () => {
      expect(connector.displayName()).toBe('WordPress');
    });
  });

  describe('service', () => {
    it('should have WORDPRESS service type', () => {
      expect(connector.service).toBe(Service.WORDPRESS);
    });
  });

  describe('getBatchSize', () => {
    it('should return batch size of 1', () => {
      expect(connector.getBatchSize()).toBe(1);
    });
  });

  describe('listTables', () => {
    it('should list all post types and default tables', async () => {
      // Mock WordPress types response with correct format
      mockClient.getTypes.mockResolvedValue({
        post: {
          name: 'Posts',
          slug: 'post',
          rest_base: 'posts',
        },
        page: {
          name: 'Pages',
          slug: 'page',
          rest_base: 'pages',
        },
      });

      const tables = await connector.listTables();

      expect(mockClient.getTypes).toHaveBeenCalledTimes(1);

      // Should return post types + default tables (categories, tags)
      expect(tables.length).toBeGreaterThan(0);

      // Check that it includes custom post types (using rest_base)
      const postTable = tables.find((t) => t.id.remoteId[0] === 'posts');
      expect(postTable).toBeDefined();
      expect(postTable?.displayName).toBe('Posts');
    });

    it('should include default tables for categories and tags', async () => {
      mockClient.getTypes.mockResolvedValue({
        post: {
          name: 'Posts',
          slug: 'post',
          rest_base: 'posts',
        },
      });

      const tables = await connector.listTables();

      // Check for default tables
      const categoryTable = tables.find((t) => t.id.remoteId[0] === 'categories');
      const tagTable = tables.find((t) => t.id.remoteId[0] === 'tags');

      expect(categoryTable).toBeDefined();
      expect(tagTable).toBeDefined();
    });

    it('should handle empty types response', async () => {
      mockClient.getTypes.mockResolvedValue({});

      const tables = await connector.listTables();

      expect(mockClient.getTypes).toHaveBeenCalledTimes(1);

      // Should still return default tables even if no custom types
      expect(tables.length).toBeGreaterThan(0);
    });

    it('should format table names correctly', async () => {
      mockClient.getTypes.mockResolvedValue({
        'custom-type': {
          name: 'Custom Post Type',
          slug: 'custom-post-type',
          rest_base: 'custom-posts',
        },
      });

      const tables = await connector.listTables();

      const customTable = tables.find((t) => t.id.remoteId[0] === 'custom-posts');
      expect(customTable).toBeDefined();
      expect(customTable?.displayName).toBe('Custom Post Type');
    });

    it('should filter out types without rest_base', async () => {
      mockClient.getTypes.mockResolvedValue({
        post: {
          name: 'Posts',
          slug: 'post',
          rest_base: 'posts',
        },
        invalid: {
          name: 'Invalid Type',
          slug: 'invalid',
          // No rest_base
        },
      });

      const tables = await connector.listTables();

      // Should only include types with rest_base
      const postTable = tables.find((t) => t.id.remoteId[0] === 'posts');
      const invalidTable = tables.find((t) => t.id.remoteId[0] === 'invalid');

      expect(postTable).toBeDefined();
      expect(invalidTable).toBeUndefined();
    });
  });
});
