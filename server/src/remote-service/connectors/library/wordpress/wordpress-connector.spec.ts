/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Service } from '@spinner/shared-types';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ConnectorRecord, PostgresColumnType } from '../../types';
import { WordPressTableSpec } from '../custom-spec-registry';
import { WordPressConnector } from './wordpress-connector';
import { WORDPRESS_POLLING_PAGE_SIZE } from './wordpress-constants';
import { WordPressDataType, WordPressEndpointOptionsResponse, WordPressRecord } from './wordpress-types';

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

// Shared test constants
const TEST_ENDPOINT = 'posts';

const MOCK_ENTITY_ID = {
  wsId: 'posts',
  remoteId: [TEST_ENDPOINT],
};

const MOCK_TITLE_COLUMN = {
  id: { wsId: 'title', remoteId: ['title'] },
  name: 'Title',
  pgType: PostgresColumnType.TEXT,
  wordpressDataType: WordPressDataType.RENDERED,
};

const MOCK_CONTENT_COLUMN = {
  id: { wsId: 'content', remoteId: ['content'] },
  name: 'Content',
  pgType: PostgresColumnType.TEXT,
  wordpressDataType: WordPressDataType.RENDERED,
};

const postsSchemaResponse = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'posts-schema-response.json'), 'utf8'),
) as WordPressEndpointOptionsResponse;

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
    it('should download records and keep basic fields as HTML', async () => {
      // Minimal table spec with just title field
      const mockTableSpec: WordPressTableSpec = {
        id: MOCK_ENTITY_ID,
        slug: 'posts',
        name: 'Posts',
        columns: [MOCK_TITLE_COLUMN],
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
      expect(mockClient.pollRecords).toHaveBeenCalledWith(TEST_ENDPOINT, 0, WORDPRESS_POLLING_PAGE_SIZE);

      expect(callback).toHaveBeenCalledTimes(1);

      const records = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records;
      expect(records).toHaveLength(2);
      expect(records[0].id).toBe('1');
      expect(records[0].fields.title).toBe('<h1>Test Post</h1>');
      expect(records[1].id).toBe('2');
      expect(records[1].fields.title).toBe('<h1>Another Post</h1>');
    });

    it('should handle pagination correctly', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: MOCK_ENTITY_ID,
        name: 'Posts',
        slug: 'posts',
        columns: [MOCK_TITLE_COLUMN],
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
      expect(mockClient.pollRecords).toHaveBeenCalledWith(TEST_ENDPOINT, 0, WORDPRESS_POLLING_PAGE_SIZE);

      // Verify callback was called once with all records
      expect(callback).toHaveBeenCalledTimes(1);

      expect((callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records).toHaveLength(2);

      const callbackArg = callback.mock.calls[0][0] as { connectorProgress?: { nextOffset: number | undefined } };
      // Should indicate no more pages
      expect(callbackArg.connectorProgress?.nextOffset).toBeUndefined();
    });

    it('should keep rendered content as HTML by default', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: MOCK_ENTITY_ID,
        name: 'Posts',
        slug: 'posts',
        columns: [MOCK_CONTENT_COLUMN],
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
      // Should default to HTML
      expect(record.fields.content).toBe('<h1>Heading</h1><p>Paragraph content</p>');
    });

    it('should keep rendered content as HTML when dataConverter is html', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: MOCK_ENTITY_ID,
        name: 'Posts',
        slug: 'posts',
        columns: [MOCK_CONTENT_COLUMN],
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
        slug: 'posts',
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

    it('should handle empty string values for ACF fields', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: { wsId: 'posts', remoteId: ['posts'] },
        name: 'Posts',
        slug: 'posts',
        columns: [
          {
            id: { wsId: 'file_array', remoteId: ['file_array'] },
            name: 'Files',
            pgType: PostgresColumnType.NUMERIC_ARRAY,
            wordpressDataType: WordPressDataType.ARRAY,
          },
          {
            id: { wsId: 'number', remoteId: ['number'] },
            name: 'Number',
            pgType: PostgresColumnType.NUMERIC,
            wordpressDataType: WordPressDataType.NUMBER,
          },
          {
            id: { wsId: 'integer', remoteId: ['integer'] },
            name: 'Integer',
            pgType: PostgresColumnType.NUMERIC,
            wordpressDataType: WordPressDataType.NUMBER,
          },
          {
            id: { wsId: 'bool', remoteId: ['bool'] },
            name: 'Boolean',
            pgType: PostgresColumnType.BOOLEAN,
            wordpressDataType: WordPressDataType.BOOLEAN,
          },
        ],
      };

      mockClient.pollRecords.mockResolvedValue([
        {
          id: 1,
          acf: {
            file_array: '',
            number: '',
            integer: '',
            bool: '',
          },
        },
        {
          id: 2,
          acf: {
            file_array: [1, 2, 3],
            number: 42,
            integer: 67,
            bool: true,
          },
        },
      ]);

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, {}, callback);

      const [record1, record2] = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records;
      expect(record1.fields.file_array).toBe(null);
      expect(record1.fields.number).toBe(null);
      expect(record1.fields.integer).toBe(null);
      expect(record1.fields.bool).toBe(null);

      expect(record2.fields.file_array).toStrictEqual([1, 2, 3]);
      expect(record2.fields.number).toBe(42);
      expect(record2.fields.integer).toBe(67);
      expect(record2.fields.bool).toBe(true);
    });

    it('should handle progress parameter for resuming downloads', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: MOCK_ENTITY_ID,
        name: 'Posts',
        slug: 'posts',
        columns: [MOCK_TITLE_COLUMN],
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
        slug: 'posts',
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
      expect(WordPressConnector.displayName).toBe('WordPress');
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

  describe('fetchTableSpec', () => {
    it('should fetch and parse the table spec for a post type', async () => {
      // Mock endpoint options response with a real response
      mockClient.getEndpointOptions.mockResolvedValue(postsSchemaResponse);

      const tableSpec = await connector.fetchTableSpec(MOCK_ENTITY_ID);

      expect(mockClient.getEndpointOptions).toHaveBeenCalledWith(TEST_ENDPOINT);
      expect(tableSpec).toMatchSnapshot();
    });

    it('should sanitize table name from table ID', async () => {
      const entityId = {
        wsId: 'custom_post_type',
        remoteId: ['custom-post-type'],
      };

      mockClient.getEndpointOptions.mockResolvedValue({
        schema: {
          properties: {
            id: { type: 'integer', context: ['view'] },
          },
        },
      });

      const tableSpec = await connector.fetchTableSpec(entityId);

      expect(tableSpec.name).toBeDefined();
      expect(tableSpec.id.remoteId[0]).toBe('custom-post-type');
    });
  });

  describe('updateRecords', () => {
    it('should convert all field types correctly and call API with proper body', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: MOCK_ENTITY_ID,
        name: 'Posts',
        slug: 'posts',
        columns: [
          {
            id: { wsId: 'string_field', remoteId: ['string_field'] },
            name: 'String Field',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.STRING,
          },
          {
            id: { wsId: 'email_field', remoteId: ['email_field'] },
            name: 'Email Field',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.EMAIL,
          },
          {
            id: { wsId: 'uri_field', remoteId: ['uri_field'] },
            name: 'URI Field',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.URI,
          },
          {
            id: { wsId: 'enum_field', remoteId: ['enum_field'] },
            name: 'Enum Field',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.ENUM,
          },
          {
            id: { wsId: 'integer_field', remoteId: ['integer_field'] },
            name: 'Integer Field',
            pgType: PostgresColumnType.NUMERIC,
            wordpressDataType: WordPressDataType.INTEGER,
          },
          {
            id: { wsId: 'number_field', remoteId: ['number_field'] },
            name: 'Number Field',
            pgType: PostgresColumnType.NUMERIC,
            wordpressDataType: WordPressDataType.NUMBER,
          },
          {
            id: { wsId: 'boolean_field', remoteId: ['boolean_field'] },
            name: 'Boolean Field',
            pgType: PostgresColumnType.BOOLEAN,
            wordpressDataType: WordPressDataType.BOOLEAN,
          },
          {
            id: { wsId: 'date_field', remoteId: ['date_field'] },
            name: 'Date Field',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.DATE,
          },
          {
            id: { wsId: 'datetime_field', remoteId: ['datetime_field'] },
            name: 'DateTime Field',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.DATETIME,
          },
          {
            id: { wsId: 'array_field', remoteId: ['array_field'] },
            name: 'Array Field',
            pgType: PostgresColumnType.NUMERIC_ARRAY,
            wordpressDataType: WordPressDataType.ARRAY,
          },
          {
            id: { wsId: 'object_field', remoteId: ['object_field'] },
            name: 'Object Field',
            pgType: PostgresColumnType.JSONB,
            wordpressDataType: WordPressDataType.OBJECT,
          },
          {
            id: { wsId: 'rendered_field_markdown', remoteId: ['rendered_field_markdown'] },
            name: 'Rendered Field (Markdown)',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.RENDERED,
          },
          {
            id: { wsId: 'rendered_field_html', remoteId: ['rendered_field_html'] },
            name: 'Rendered Field (HTML)',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.RENDERED,
          },
          {
            id: { wsId: 'title', remoteId: ['title'] },
            name: 'Title',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.RENDERED_INLINE,
          },
          {
            id: { wsId: 'foreign_key_field', remoteId: ['foreign_key_field'] },
            name: 'Foreign Key Field',
            pgType: PostgresColumnType.NUMERIC,
            wordpressDataType: WordPressDataType.FOREIGN_KEY,
          },
          {
            id: { wsId: 'unknown_field', remoteId: ['unknown_field'] },
            name: 'Unknown Field',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.UNKNOWN,
          },
          {
            id: { wsId: 'readonly_field', remoteId: ['readonly_field'] },
            name: 'Readonly Field',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.STRING,
            readonly: true,
          },
        ],
      };

      const columnSettingsMap = {
        rendered_field_markdown: {
          dataConverter: 'markdown',
        },
        rendered_field_html: {
          dataConverter: 'html',
        },
        title: {
          dataConverter: 'markdown',
        },
      };

      const recordsToUpdate = [
        {
          id: { wsId: 'test-ws-id', remoteId: '123' },
          partialFields: {
            string_field: 'Test String',
            email_field: 'test@example.com',
            uri_field: 'https://example.com',
            enum_field: 'option1',
            integer_field: 42,
            number_field: 3.14,
            boolean_field: true,
            date_field: '2023-01-15',
            datetime_field: '2023-01-15T10:30:00Z',
            array_field: [1, 2, 3],
            object_field: { key: 'value', nested: { prop: 123 } },
            rendered_field_markdown: '# Heading\n\nParagraph with **bold** text.',
            rendered_field_html: '<h1>Heading</h1><p>HTML content</p>',
            title: 'Hello World',
            foreign_key_field: 456,
            unknown_field: 'unknown value',
            readonly_field: 'This should be ignored',
          },
        },
      ];

      mockClient.updateRecord.mockResolvedValue(undefined);

      await connector.updateRecords(mockTableSpec, columnSettingsMap, recordsToUpdate);

      expect(mockClient.updateRecord).toHaveBeenCalledTimes(1);
      expect(mockClient.updateRecord).toHaveBeenCalledWith(TEST_ENDPOINT, '123', expect.any(Object));

      // Snapshot the request body to ensure all field conversions are correct
      const requestBody = mockClient.updateRecord.mock.calls[0][2] as WordPressRecord;
      expect(requestBody).toMatchSnapshot();
    });

    it('should only include modified columns in the request body', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: MOCK_ENTITY_ID,
        name: 'Posts',
        slug: 'posts',
        columns: [
          {
            id: { wsId: 'title', remoteId: ['title'] },
            name: 'Title',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.RENDERED,
          },
          {
            id: { wsId: 'status', remoteId: ['status'] },
            name: 'Status',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.STRING,
          },
        ],
      };

      const recordsToUpdate = [
        {
          id: { wsId: 'test-ws-id', remoteId: '456' },
          partialFields: {
            status: 'draft', // Only updating status, not title
          },
        },
      ];

      mockClient.updateRecord.mockResolvedValue(undefined);

      await connector.updateRecords(mockTableSpec, {}, recordsToUpdate);

      const requestBody = mockClient.updateRecord.mock.calls[0][2] as WordPressRecord;
      expect(requestBody).toEqual({
        status: 'draft',
      });
      expect(requestBody).not.toHaveProperty('title');
    });

    it('should handle markdown to HTML conversion for rendered fields', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: MOCK_ENTITY_ID,
        name: 'Posts',
        slug: 'posts',
        columns: [MOCK_CONTENT_COLUMN],
      };

      const recordsToUpdate = [
        {
          id: { wsId: 'test-ws-id', remoteId: '789' },
          partialFields: {
            content: '# Main Heading\n\n## Subheading\n\nParagraph with *italic* and **bold**.',
          },
        },
      ];

      const columnSettingsMap = {
        content: {
          dataConverter: 'markdown',
        },
      };

      mockClient.updateRecord.mockResolvedValue(undefined);

      await connector.updateRecords(mockTableSpec, columnSettingsMap, recordsToUpdate);

      const requestBody = mockClient.updateRecord.mock.calls[0][2] as WordPressRecord;
      // Markdown should be converted to HTML
      expect(requestBody.content).toContain('<h1>Main Heading</h1>');
      expect(requestBody.content).toContain('<h2>Subheading</h2>');
      expect(requestBody.content).toContain('<em>italic</em>');
      expect(requestBody.content).toContain('<strong>bold</strong>');
    });

    it('should keep HTML as-is when dataConverter is html', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: MOCK_ENTITY_ID,
        name: 'Posts',
        slug: 'posts',
        columns: [MOCK_CONTENT_COLUMN],
      };

      const columnSettingsMap = {
        content: {
          dataConverter: 'html',
        },
      };

      const htmlContent = '<div class="custom"><h1>Title</h1><p>Content</p></div>';
      const recordsToUpdate = [
        {
          id: { wsId: 'test-ws-id', remoteId: '999' },
          partialFields: {
            content: htmlContent,
          },
        },
      ];

      mockClient.updateRecord.mockResolvedValue(undefined);

      await connector.updateRecords(mockTableSpec, columnSettingsMap, recordsToUpdate);

      const requestBody = mockClient.updateRecord.mock.calls[0][2] as WordPressRecord;
      // HTML should be kept as-is
      expect(requestBody.content).toBe(htmlContent);
    });

    it('should process multiple records sequentially', async () => {
      const mockTableSpec: WordPressTableSpec = {
        id: MOCK_ENTITY_ID,
        name: 'Posts',
        slug: 'posts',
        columns: [
          {
            id: { wsId: 'status', remoteId: ['status'] },
            name: 'Status',
            pgType: PostgresColumnType.TEXT,
            wordpressDataType: WordPressDataType.STRING,
          },
        ],
      };

      const recordsToUpdate = [
        {
          id: { wsId: 'test-ws-id-1', remoteId: '100' },
          partialFields: { status: 'publish' },
        },
        {
          id: { wsId: 'test-ws-id-2', remoteId: '200' },
          partialFields: { status: 'draft' },
        },
        {
          id: { wsId: 'test-ws-id-3', remoteId: '300' },
          partialFields: { status: 'pending' },
        },
      ];

      mockClient.updateRecord.mockResolvedValue(undefined);

      await connector.updateRecords(mockTableSpec, {}, recordsToUpdate);

      expect(mockClient.updateRecord).toHaveBeenCalledTimes(3);
      expect(mockClient.updateRecord).toHaveBeenNthCalledWith(1, TEST_ENDPOINT, '100', { status: 'publish' });
      expect(mockClient.updateRecord).toHaveBeenNthCalledWith(2, TEST_ENDPOINT, '200', { status: 'draft' });
      expect(mockClient.updateRecord).toHaveBeenNthCalledWith(3, TEST_ENDPOINT, '300', { status: 'pending' });
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
