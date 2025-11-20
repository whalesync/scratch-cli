import { Service } from '@prisma/client';
import { ConnectorRecord, PostgresColumnType } from '../../types';
import { NotionTableSpec } from '../custom-spec-registry';
import { NotionConnector } from './notion-connector';

// Create minimal mocks
const mockClient = {
  databases: {
    query: jest.fn(),
  },
  blocks: {
    children: {
      list: jest.fn(),
    },
  },
};

jest.mock('@notionhq/client', () => ({
  Client: jest.fn(() => mockClient),
}));

jest.mock('turndown', () =>
  jest.fn().mockImplementation(() => ({
    turndown: jest.fn((html: string) => html.replace(/<[^>]*>/g, '')),
  })),
);

jest.mock('./conversion/notion-rich-text-conversion', () => ({
  convertNotionBlockObjectToHtmlv2: jest.fn(() => '<p>content</p>'),
}));

jest.mock('src/logger', () => ({
  WSLogger: { error: jest.fn() },
}));

// Shared test constants
const TEST_DB_ID = 'db123';
const TEST_DB_ID_2 = 'db456';
const TEST_DB_ID_3 = 'db789';
const TEST_TITLE_ID = 'title-id';
const TEST_STATUS_ID = 'status-id';
const TEST_NAME_ID = 'name-id';

const MOCK_ENTITY_ID = {
  wsId: 'db1',
  remoteId: [TEST_DB_ID],
};

const MOCK_TITLE_COLUMN = {
  id: { wsId: 'title', remoteId: [TEST_TITLE_ID] },
  name: 'Title',
  pgType: PostgresColumnType.TEXT,
  notionDataType: 'title' as const,
};

describe('NotionConnector', () => {
  let connector: NotionConnector;

  beforeEach(() => {
    jest.clearAllMocks();
    connector = new NotionConnector('test-api-key');
  });

  describe('downloadTableRecords', () => {
    it('should download records and transform basic fields', async () => {
      // Minimal table spec with just one field (no page content)
      const mockTableSpec: NotionTableSpec = {
        id: MOCK_ENTITY_ID,
        name: 'Test DB',
        columns: [MOCK_TITLE_COLUMN],
      };

      // Minimal mock data
      mockClient.databases.query.mockResolvedValue({
        results: [
          {
            object: 'page',
            id: 'page1',
            properties: {
              Title: {
                id: TEST_TITLE_ID,
                type: 'title',
                title: [{ plain_text: 'Test' }],
              },
            },
          },
        ],
        has_more: false,
        next_cursor: null,
      });

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, {}, callback);

      expect(callback).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const records = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records;
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe('page1');
      expect(records[0].fields.title).toBe('Test');
    });

    it('should handle pagination', async () => {
      const mockTableSpec: NotionTableSpec = {
        id: MOCK_ENTITY_ID,
        name: 'Test DB',
        columns: [MOCK_TITLE_COLUMN],
      };

      mockClient.databases.query
        .mockResolvedValueOnce({
          results: [
            {
              object: 'page',
              id: 'page1',
              properties: {
                Title: { id: TEST_TITLE_ID, type: 'title', title: [{ plain_text: 'Page 1' }] },
              },
            },
          ],
          has_more: true,
          next_cursor: 'cursor1',
        })
        .mockResolvedValueOnce({
          results: [
            {
              object: 'page',
              id: 'page2',
              properties: {
                Title: { id: TEST_TITLE_ID, type: 'title', title: [{ plain_text: 'Page 2' }] },
              },
            },
          ],
          has_more: false,
          next_cursor: null,
        });

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, {}, callback);

      expect(mockClient.databases.query).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('displayName', () => {
    it('should return Notion as display name', () => {
      expect(NotionConnector.displayName).toBe('Notion');
    });
  });

  describe('service', () => {
    it('should have NOTION service type', () => {
      expect(connector.service).toBe(Service.NOTION);
    });
  });

  describe('getBatchSize', () => {
    it('should return batch size of 1', () => {
      expect(connector.getBatchSize()).toBe(1);
    });
  });

  describe('fetchTableSpec', () => {
    it('should fetch table spec for a database', async () => {
      // Mock database retrieval with properties
      (mockClient as unknown as { databases: { retrieve: jest.Mock } }).databases = {
        retrieve: jest.fn().mockResolvedValue({
          object: 'database',
          id: TEST_DB_ID,
          title: [{ plain_text: 'Test Database' }],
          properties: {
            Title: {
              id: TEST_TITLE_ID,
              type: 'title',
              name: 'Title',
              title: {},
            },
            Status: {
              id: TEST_STATUS_ID,
              type: 'select',
              name: 'Status',
              select: {
                options: [
                  { name: 'Active', id: 'opt1', color: 'green' },
                  { name: 'Inactive', id: 'opt2', color: 'red' },
                ],
              },
            },
          },
        }),
      };

      const tableSpec = await connector.fetchTableSpec(MOCK_ENTITY_ID);

      expect((mockClient as unknown as { databases: { retrieve: jest.Mock } }).databases.retrieve).toHaveBeenCalledWith(
        {
          database_id: TEST_DB_ID,
        },
      );
      expect(tableSpec.id).toEqual(MOCK_ENTITY_ID);
      expect(tableSpec.columns).toBeDefined();
      // Should have properties + Page Content column
      expect(tableSpec.columns.length).toBeGreaterThan(2);
    });

    it('should always include Page Content column', async () => {
      const entityId = {
        wsId: 'db2',
        remoteId: [TEST_DB_ID_2],
      };

      (mockClient as unknown as { databases: { retrieve: jest.Mock } }).databases = {
        retrieve: jest.fn().mockResolvedValue({
          object: 'database',
          id: TEST_DB_ID_2,
          title: [{ plain_text: 'Simple DB' }],
          properties: {
            Name: {
              id: TEST_NAME_ID,
              type: 'title',
              name: 'Name',
              title: {},
            },
          },
        }),
      };

      const tableSpec = await connector.fetchTableSpec(entityId);

      // Should have at least 2 columns: Name + Page Content
      expect(tableSpec.columns.length).toBeGreaterThanOrEqual(2);

      // Check for Page Content column
      const pageContentColumn = tableSpec.columns.find((col) => col.name === 'Page Content');
      expect(pageContentColumn).toBeDefined();
      expect(pageContentColumn?.id.wsId).toBe('WS_PAGE_CONTENT');
    });

    it('should handle database with empty title', async () => {
      const entityId = {
        wsId: 'db3',
        remoteId: [TEST_DB_ID_3],
      };

      (mockClient as unknown as { databases: { retrieve: jest.Mock } }).databases = {
        retrieve: jest.fn().mockResolvedValue({
          object: 'database',
          id: TEST_DB_ID_3,
          title: [],
          properties: {},
        }),
      };

      const tableSpec = await connector.fetchTableSpec(entityId);

      expect(tableSpec.id).toEqual(entityId);
      expect(tableSpec.name).toBeDefined();
      // Should still have Page Content column
      expect(tableSpec.columns.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('listTables', () => {
    it('should list all databases', async () => {
      mockClient.databases = {
        query: jest.fn(),
      };

      // Mock search to return databases
      (mockClient as unknown as { search: jest.Mock }).search = jest.fn().mockResolvedValue({
        results: [
          {
            object: 'database',
            id: 'db1',
            title: [{ plain_text: 'Database 1' }],
          },
          {
            object: 'database',
            id: 'db2',
            title: [{ plain_text: 'Database 2' }],
          },
        ],
      });

      const tables = await connector.listTables();

      expect((mockClient as unknown as { search: jest.Mock }).search).toHaveBeenCalledTimes(1);
      expect((mockClient as unknown as { search: jest.Mock }).search).toHaveBeenCalledWith({
        filter: { property: 'object', value: 'database' },
      });

      expect(tables).toHaveLength(2);
    });

    it('should filter out non-database results', async () => {
      (mockClient as unknown as { search: jest.Mock }).search = jest.fn().mockResolvedValue({
        results: [
          {
            object: 'database',
            id: 'db1',
            title: [{ plain_text: 'Database 1' }],
          },
          {
            object: 'page',
            id: 'page1',
            title: [{ plain_text: 'Page 1' }],
          },
          {
            object: 'database',
            id: 'db2',
            title: [{ plain_text: 'Database 2' }],
          },
        ],
      });

      const tables = await connector.listTables();

      // Should only return databases, not pages
      expect(tables).toHaveLength(2);
    });

    it('should handle empty search results', async () => {
      (mockClient as unknown as { search: jest.Mock }).search = jest.fn().mockResolvedValue({
        results: [],
      });

      const tables = await connector.listTables();

      expect(tables).toHaveLength(0);
    });
  });
});
