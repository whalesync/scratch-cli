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
        id: { wsId: 'db1', remoteId: ['db123'] },
        name: 'Test DB',
        columns: [
          {
            id: { wsId: 'title', remoteId: ['title-id'] },
            name: 'Title',
            pgType: PostgresColumnType.TEXT,
            notionDataType: 'title',
          },
        ],
      };

      // Minimal mock data
      mockClient.databases.query.mockResolvedValue({
        results: [
          {
            object: 'page',
            id: 'page1',
            properties: {
              Title: {
                id: 'title-id',
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
        id: { wsId: 'db1', remoteId: ['db123'] },
        name: 'Test DB',
        columns: [
          {
            id: { wsId: 'title', remoteId: ['title-id'] },
            name: 'Title',
            pgType: PostgresColumnType.TEXT,
            notionDataType: 'title',
          },
        ],
      };

      mockClient.databases.query
        .mockResolvedValueOnce({
          results: [
            {
              object: 'page',
              id: 'page1',
              properties: {
                Title: { id: 'title-id', type: 'title', title: [{ plain_text: 'Page 1' }] },
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
                Title: { id: 'title-id', type: 'title', title: [{ plain_text: 'Page 2' }] },
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
      expect(connector.displayName()).toBe('Notion');
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
});
