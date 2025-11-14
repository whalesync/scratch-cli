import { Service } from '@prisma/client';
import { Webflow } from 'webflow-api';
import { ConnectorRecord, PostgresColumnType } from '../../types';
import { WebflowTableSpec } from '../custom-spec-registry';
import { WEBFLOW_DEFAULT_BATCH_SIZE, WebflowConnector } from './webflow-connector';

// Mock html-minify
jest.mock('../../../../wrappers/html-minify', () => ({
  minifyHtml: jest.fn((html: string) => Promise.resolve(html)),
}));

// Create a shared mock client instance
const createMockClient = () => ({
  sites: {
    list: jest.fn(),
    get: jest.fn(),
  },
  collections: {
    list: jest.fn(),
    get: jest.fn(),
    items: {
      listItems: jest.fn(),
      createItems: jest.fn(),
      updateItems: jest.fn(),
      deleteItems: jest.fn(),
    },
  },
});

let sharedMockClient: ReturnType<typeof createMockClient>;

// Mock the webflow-api module
jest.mock('webflow-api', () => ({
  Webflow: {
    FieldType: {
      PlainText: 'PlainText',
      RichText: 'RichText',
      Number: 'Number',
    },
  },
  WebflowClient: jest.fn().mockImplementation(() => {
    if (!sharedMockClient) {
      sharedMockClient = createMockClient();
    }
    return sharedMockClient;
  }),
}));

// Shared test constants
const TEST_SITE_ID = 'site123';
const TEST_COLLECTION_ID = 'collection456';
const TEST_COLLECTION_ID_2 = 'collection789';

const MOCK_SITE = {
  id: TEST_SITE_ID,
  displayName: 'Test Site',
  shortName: 'test-site',
};

const MOCK_ENTITY_ID = {
  wsId: 'test-collection',
  remoteId: [TEST_SITE_ID, TEST_COLLECTION_ID],
};

describe('WebflowConnector', () => {
  let connector: WebflowConnector;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    // Create a fresh mock client for each test
    sharedMockClient = createMockClient();
    mockClient = sharedMockClient;

    // Create connector instance - this will use the mocked client
    connector = new WebflowConnector('test-access-token');
  });

  describe('downloadTableRecords', () => {
    const mockTableSpec: WebflowTableSpec = {
      id: MOCK_ENTITY_ID,
      name: 'Test Collection',
      columns: [
        {
          id: {
            wsId: 'name-field',
            remoteId: ['name'],
          },
          name: 'Name',
          slug: 'name',
          pgType: PostgresColumnType.TEXT,
          webflowFieldType: Webflow.FieldType.PlainText,
        },
        {
          id: {
            wsId: 'description-field',
            remoteId: ['description'],
          },
          name: 'Description',
          slug: 'description',
          pgType: PostgresColumnType.TEXT,
          webflowFieldType: Webflow.FieldType.RichText,
        },
        {
          id: {
            wsId: 'count-field',
            remoteId: ['count'],
          },
          name: 'Count',
          slug: 'count',
          pgType: PostgresColumnType.NUMERIC,
          webflowFieldType: Webflow.FieldType.Number,
        },
        {
          id: {
            wsId: 'isDraft',
            remoteId: ['isDraft'],
          },
          name: 'Is Draft',
          slug: undefined,
          pgType: PostgresColumnType.BOOLEAN,
        },
      ],
    };

    const mockColumnSettingsMap = {};

    it('should download records and transform them correctly', async () => {
      const mockItems = [
        {
          id: 'item1',
          fieldData: {
            name: 'Test Item 1',
            description: '<p>Test description 1</p>',
            count: 42,
          },
          isDraft: false,
          isArchived: false,
          createdOn: '2024-01-01T00:00:00Z',
        },
        {
          id: 'item2',
          fieldData: {
            name: 'Test Item 2',
            description: '<p>Test description 2</p>',
            count: 100,
          },
          isDraft: true,
          isArchived: false,
          createdOn: '2024-01-02T00:00:00Z',
        },
      ];

      mockClient.collections.items.listItems.mockResolvedValue({
        items: mockItems,
        pagination: {
          total: 2,
          offset: 0,
          limit: 100,
        },
      });

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, mockColumnSettingsMap, callback);

      expect(mockClient.collections.items.listItems).toHaveBeenCalledTimes(1);
      expect(mockClient.collections.items.listItems).toHaveBeenCalledWith(TEST_COLLECTION_ID, {
        offset: 0,
        limit: WEBFLOW_DEFAULT_BATCH_SIZE,
      });

      expect(callback).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const callbackArg = callback.mock.calls[0][0] as { records: ConnectorRecord[] };
      expect(callbackArg.records).toHaveLength(2);

      // Verify first record
      expect(callbackArg.records[0]).toEqual({
        id: 'item1',
        fields: {
          name: 'Test Item 1',
          description: 'Test description 1',
          count: 42,
          isDraft: false,
        },
        metadata: {
          isDraft: false,
          isArchived: false,
          createdOn: '2024-01-01T00:00:00Z',
        },
      });

      // Verify second record
      expect(callbackArg.records[1]).toEqual({
        id: 'item2',
        fields: {
          name: 'Test Item 2',
          description: 'Test description 2',
          count: 100,
          isDraft: true,
        },
        metadata: {
          isDraft: true,
          isArchived: false,
          createdOn: '2024-01-02T00:00:00Z',
        },
      });
    });

    it('should handle pagination correctly', async () => {
      const firstBatch = Array.from({ length: 100 }, (_, i) => ({
        id: `item${i}`,
        fieldData: {
          name: `Item ${i}`,
        },
      }));

      const secondBatch = Array.from({ length: 50 }, (_, i) => ({
        id: `item${i + 100}`,
        fieldData: {
          name: `Item ${i + 100}`,
        },
      }));

      mockClient.collections.items.listItems
        .mockResolvedValueOnce({
          items: firstBatch,
          pagination: {
            total: 150,
            offset: 0,
            limit: 100,
          },
        })
        .mockResolvedValueOnce({
          items: secondBatch,
          pagination: {
            total: 150,
            offset: 100,
            limit: 100,
          },
        });

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, mockColumnSettingsMap, callback);

      // Verify API was called twice for pagination
      expect(mockClient.collections.items.listItems).toHaveBeenCalledTimes(2);
      expect(mockClient.collections.items.listItems).toHaveBeenNthCalledWith(1, TEST_COLLECTION_ID, {
        offset: 0,
        limit: WEBFLOW_DEFAULT_BATCH_SIZE,
      });
      expect(mockClient.collections.items.listItems).toHaveBeenNthCalledWith(2, TEST_COLLECTION_ID, {
        offset: 100,
        limit: WEBFLOW_DEFAULT_BATCH_SIZE,
      });

      // Verify callback was called twice
      expect(callback).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records).toHaveLength(100);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((callback.mock.calls[1][0] as { records: ConnectorRecord[] }).records).toHaveLength(50);
    });

    it('should convert rich text to markdown by default', async () => {
      const mockItems = [
        {
          id: 'item1',
          fieldData: {
            description: '<h1>Heading</h1><p>Paragraph with <strong>bold</strong> text</p>',
          },
        },
      ];

      mockClient.collections.items.listItems.mockResolvedValue({
        items: mockItems,
        pagination: { total: 1, offset: 0, limit: 100 },
      });

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, mockColumnSettingsMap, callback);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const record = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records[0];
      // Turndown converts HTML to markdown
      expect(record.fields.description).toBe('# Heading\n\nParagraph with **bold** text');
    });

    it('should keep rich text as HTML when dataConverter is html', async () => {
      const mockItems = [
        {
          id: 'item1',
          fieldData: {
            description: '<h1>Heading</h1><p>Paragraph</p>',
          },
        },
      ];

      mockClient.collections.items.listItems.mockResolvedValue({
        items: mockItems,
        pagination: { total: 1, offset: 0, limit: 100 },
      });

      const columnSettingsMapWithHtml = {
        'description-field': {
          dataConverter: 'html',
        },
      };

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, columnSettingsMapWithHtml, callback);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const record = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records[0];
      // Should keep HTML as-is
      expect(record.fields.description).toBe('<h1>Heading</h1><p>Paragraph</p>');
    });

    it('should handle metadata columns correctly', async () => {
      const mockItems = [
        {
          id: 'item1',
          fieldData: {
            name: 'Test',
          },
          isDraft: true,
          isArchived: false,
          lastPublished: '2024-01-01T00:00:00Z',
          lastUpdated: '2024-01-02T00:00:00Z',
          createdOn: '2024-01-03T00:00:00Z',
        },
      ];

      mockClient.collections.items.listItems.mockResolvedValue({
        items: mockItems,
        pagination: { total: 1, offset: 0, limit: 100 },
      });

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, mockColumnSettingsMap, callback);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const record = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records[0];

      // Metadata columns should be in both fields and metadata
      expect(record.fields.isDraft).toBe(true);
      expect(record.metadata).toEqual({
        isDraft: true,
        isArchived: false,
        lastPublished: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-02T00:00:00Z',
        createdOn: '2024-01-03T00:00:00Z',
      });
    });
  });

  describe('displayName', () => {
    it('should return Webflow as display name', () => {
      expect(connector.displayName()).toBe('Webflow');
    });
  });

  describe('service', () => {
    it('should have WEBFLOW service type', () => {
      expect(connector.service).toBe(Service.WEBFLOW);
    });
  });

  describe('getBatchSize', () => {
    it('should return default batch size', () => {
      expect(connector.getBatchSize()).toBe(WEBFLOW_DEFAULT_BATCH_SIZE);
    });
  });

  describe('fetchTableSpec', () => {
    it('should fetch table spec for a collection', async () => {
      // Mock site response
      mockClient.sites.get.mockResolvedValue(MOCK_SITE);

      // Mock collection response with schema
      mockClient.collections.get.mockResolvedValue({
        id: TEST_COLLECTION_ID,
        displayName: 'Test Collection',
        singularName: 'Item',
        slug: 'test-collection',
        fields: [
          {
            id: 'field1',
            slug: 'name',
            displayName: 'Name',
            type: Webflow.FieldType.PlainText,
            isRequired: true,
          },
          {
            id: 'field2',
            slug: 'description',
            displayName: 'Description',
            type: Webflow.FieldType.RichText,
            isRequired: false,
          },
        ],
      });

      const tableSpec = await connector.fetchTableSpec(MOCK_ENTITY_ID);

      expect(mockClient.sites.get).toHaveBeenCalledWith(TEST_SITE_ID);
      expect(mockClient.collections.get).toHaveBeenCalledWith(TEST_COLLECTION_ID);
      expect(tableSpec.id.remoteId).toEqual(MOCK_ENTITY_ID.remoteId);
      expect(tableSpec.columns).toBeDefined();
    });

    it('should handle collection with no fields', async () => {
      const entityId = {
        wsId: 'empty-collection',
        remoteId: [TEST_SITE_ID, TEST_COLLECTION_ID_2],
      };

      mockClient.sites.get.mockResolvedValue(MOCK_SITE);

      mockClient.collections.get.mockResolvedValue({
        id: TEST_COLLECTION_ID_2,
        displayName: 'Empty Collection',
        fields: [],
      });

      const tableSpec = await connector.fetchTableSpec(entityId);

      expect(tableSpec.id.remoteId).toEqual(entityId.remoteId);
      expect(tableSpec.columns).toBeDefined();
    });
  });

  describe('listTables', () => {
    it('should list all collections from all sites', async () => {
      // Mock sites response
      mockClient.sites.list.mockResolvedValue({
        sites: [
          { id: 'site1', displayName: 'Site 1' },
          { id: 'site2', displayName: 'Site 2' },
        ],
      });

      // Mock collections for each site
      mockClient.collections.list
        .mockResolvedValueOnce({
          collections: [
            { id: 'collection1', displayName: 'Collection 1' },
            { id: 'collection2', displayName: 'Collection 2' },
          ],
        })
        .mockResolvedValueOnce({
          collections: [{ id: 'collection3', displayName: 'Collection 3' }],
        });

      const tables = await connector.listTables();

      // Verify sites were listed
      expect(mockClient.sites.list).toHaveBeenCalledTimes(1);

      // Verify collections were listed for each site
      expect(mockClient.collections.list).toHaveBeenCalledTimes(2);
      expect(mockClient.collections.list).toHaveBeenNthCalledWith(1, 'site1');
      expect(mockClient.collections.list).toHaveBeenNthCalledWith(2, 'site2');

      // Verify all collections are returned
      expect(tables).toHaveLength(3);
    });

    it('should handle sites with no collections', async () => {
      mockClient.sites.list.mockResolvedValue({
        sites: [{ id: 'site1', displayName: 'Site 1' }],
      });

      mockClient.collections.list.mockResolvedValue({
        collections: [],
      });

      const tables = await connector.listTables();

      expect(mockClient.sites.list).toHaveBeenCalledTimes(1);
      expect(mockClient.collections.list).toHaveBeenCalledTimes(1);
      expect(tables).toHaveLength(0);
    });

    it('should handle empty sites response', async () => {
      mockClient.sites.list.mockResolvedValue({
        sites: [],
      });

      const tables = await connector.listTables();

      expect(mockClient.sites.list).toHaveBeenCalledTimes(1);
      expect(mockClient.collections.list).not.toHaveBeenCalled();
      expect(tables).toHaveLength(0);
    });

    it('should handle undefined collections array', async () => {
      mockClient.sites.list.mockResolvedValue({
        sites: [{ id: 'site1', displayName: 'Site 1' }],
      });

      mockClient.collections.list.mockResolvedValue({
        collections: undefined,
      });

      const tables = await connector.listTables();

      expect(tables).toHaveLength(0);
    });
  });
});
