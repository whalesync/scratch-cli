import { Service } from '@spinner/shared-types';
import type { DraftPost } from '@wix/auto_sdk_blog_draft-posts';
import { ConnectorRecord, PostgresColumnType } from '../../../types';
import { WixBlogTableSpec } from '../../custom-spec-registry';
import { WIX_DEFAULT_BATCH_SIZE, WixBlogConnector } from './wix-blog-connector';

// Mock html-minify
jest.mock('../../../../../wrappers/html-minify', () => ({
  minifyHtml: jest.fn((html: string) => Promise.resolve(html)),
}));

// Create a shared mock client instance
const createMockClient = () => ({
  draftPosts: {
    listDraftPosts: jest.fn(),
    getDraftPost: jest.fn(),
    createDraftPost: jest.fn(),
    updateDraftPost: jest.fn(),
    deleteDraftPost: jest.fn(),
  },
  members: {
    queryMembers: jest.fn(),
  },
});

let sharedMockClient: ReturnType<typeof createMockClient>;

// Mock the @wix/sdk module
jest.mock('@wix/sdk', () => ({
  createClient: jest.fn().mockImplementation(() => {
    if (!sharedMockClient) {
      sharedMockClient = createMockClient();
    }
    return sharedMockClient;
  }),
  OAuthStrategy: jest.fn().mockReturnValue({}),
  TokenRole: {
    NONE: 'NONE',
  },
}));

// Mock the @wix/blog and @wix/members modules
jest.mock('@wix/blog', () => ({
  draftPosts: {},
}));

jest.mock('@wix/members', () => ({
  members: {},
}));

describe('WixBlogConnector', () => {
  let connector: WixBlogConnector;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    // Create a fresh mock client for each test
    sharedMockClient = createMockClient();
    mockClient = sharedMockClient;

    // Mock the queryMembers to return empty results by default
    mockClient.members.queryMembers.mockReturnValue({
      find: jest.fn().mockResolvedValue({ items: [] }),
    });

    // Create connector instance - this will use the mocked client
    connector = new WixBlogConnector('test-access-token');
  });

  describe('downloadTableRecords', () => {
    const mockTableSpec: WixBlogTableSpec = {
      slug: 'blog-posts',
      id: {
        wsId: 'wix-blog',
        remoteId: ['wix-blog'],
      },
      name: 'Blog Posts',
      columns: [
        {
          id: {
            wsId: 'title',
            remoteId: ['title'],
          },
          name: 'Title',
          pgType: PostgresColumnType.TEXT,
          wixFieldType: 'PlainText',
        },
        {
          id: {
            wsId: 'richContent',
            remoteId: ['richContent'],
          },
          name: 'Content',
          pgType: PostgresColumnType.TEXT,
          wixFieldType: 'RichText',
        },
      ],
      wixAuthors: [],
    };

    const mockColumnSettingsMap = {};

    it('should download records and transform them correctly', async () => {
      const mockPosts: DraftPost[] = [
        {
          _id: 'post1',
          title: 'Test Post 1',
          richContent: {
            nodes: [
              {
                type: 'PARAGRAPH',
                id: 'para1',
                nodes: [
                  {
                    type: 'TEXT',
                    id: 'text1',
                    nodes: [],
                    textData: {
                      text: 'Test content 1',
                      decorations: [],
                    },
                  },
                ],
                paragraphData: {},
              },
            ],
          },
        },
        {
          _id: 'post2',
          title: 'Test Post 2',
          richContent: {
            nodes: [
              {
                type: 'PARAGRAPH',
                id: 'para2',
                nodes: [
                  {
                    type: 'TEXT',
                    id: 'text2',
                    nodes: [],
                    textData: {
                      text: 'Test content 2',
                      decorations: [],
                    },
                  },
                ],
                paragraphData: {},
              },
            ],
          },
        },
      ];

      mockClient.draftPosts.listDraftPosts.mockResolvedValue({
        draftPosts: mockPosts,
        metaData: {
          total: 2,
          offset: 0,
        },
      });

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, mockColumnSettingsMap, callback);

      expect(mockClient.draftPosts.listDraftPosts).toHaveBeenCalledTimes(1);
      expect(mockClient.draftPosts.listDraftPosts).toHaveBeenCalledWith({
        paging: {
          limit: WIX_DEFAULT_BATCH_SIZE,
          offset: 0,
        },
        fieldsets: ['RICH_CONTENT'],
      });

      expect(callback).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const callbackArg = callback.mock.calls[0][0] as { records: ConnectorRecord[] };
      expect(callbackArg.records).toHaveLength(2);

      // Verify first record
      expect(callbackArg.records[0]).toEqual({
        id: 'post1',
        fields: {
          title: 'Test Post 1',
          richContent: 'Test content 1',
        },
        metadata: {},
        errors: {
          byField: {
            richContent: [
              {
                message:
                  'Some Wix content cannot be represented in Markdown. Content may be lost when you publish this record.',
                severity: 'warning',
              },
            ],
          },
        },
      });

      // Verify second record
      expect(callbackArg.records[1]).toEqual({
        id: 'post2',
        fields: {
          title: 'Test Post 2',
          richContent: 'Test content 2',
        },
        metadata: {},
        errors: {
          byField: {
            richContent: [
              {
                message:
                  'Some Wix content cannot be represented in Markdown. Content may be lost when you publish this record.',
                severity: 'warning',
              },
            ],
          },
        },
      });
    });

    it('should handle pagination correctly', async () => {
      const firstBatch: DraftPost[] = Array.from({ length: 100 }, (_, i) => ({
        _id: `post${i}`,
        title: `Post ${i}`,
      }));

      const secondBatch: DraftPost[] = Array.from({ length: 50 }, (_, i) => ({
        _id: `post${i + 100}`,
        title: `Post ${i + 100}`,
      }));

      mockClient.draftPosts.listDraftPosts
        .mockResolvedValueOnce({
          draftPosts: firstBatch,
          metaData: {
            total: 150,
            offset: 0,
          },
        })
        .mockResolvedValueOnce({
          draftPosts: secondBatch,
          metaData: {
            total: 150,
            offset: 100,
          },
        });

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, mockColumnSettingsMap, callback);

      // Verify API was called twice for pagination
      expect(mockClient.draftPosts.listDraftPosts).toHaveBeenCalledTimes(2);
      expect(mockClient.draftPosts.listDraftPosts).toHaveBeenNthCalledWith(1, {
        paging: {
          limit: WIX_DEFAULT_BATCH_SIZE,
          offset: 0,
        },
        fieldsets: ['RICH_CONTENT'],
      });
      expect(mockClient.draftPosts.listDraftPosts).toHaveBeenNthCalledWith(2, {
        paging: {
          limit: WIX_DEFAULT_BATCH_SIZE,
          offset: 100,
        },
        fieldsets: ['RICH_CONTENT'],
      });

      // Verify callback was called twice
      expect(callback).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records).toHaveLength(100);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((callback.mock.calls[1][0] as { records: ConnectorRecord[] }).records).toHaveLength(50);
    });

    it('should convert rich text to markdown by default', async () => {
      const mockPosts: DraftPost[] = [
        {
          _id: 'post1',
          richContent: {
            nodes: [
              {
                type: 'HEADING',
                id: 'heading1',
                nodes: [
                  {
                    type: 'TEXT',
                    id: 'text1',
                    nodes: [],
                    textData: {
                      text: 'Heading',
                      decorations: [],
                    },
                  },
                ],
                headingData: {
                  level: 1,
                },
              },
              {
                type: 'PARAGRAPH',
                id: 'para1',
                nodes: [
                  {
                    type: 'TEXT',
                    id: 'text2',
                    nodes: [],
                    textData: {
                      text: 'Paragraph with ',
                      decorations: [],
                    },
                  },
                  {
                    type: 'TEXT',
                    id: 'text3',
                    nodes: [],
                    textData: {
                      text: 'bold',
                      decorations: [
                        {
                          type: 'BOLD',
                          fontWeightValue: 700,
                        },
                      ],
                    },
                  },
                  {
                    type: 'TEXT',
                    id: 'text4',
                    nodes: [],
                    textData: {
                      text: ' text',
                      decorations: [],
                    },
                  },
                ],
                paragraphData: {},
              },
            ],
          },
        },
      ];

      mockClient.draftPosts.listDraftPosts.mockResolvedValue({
        draftPosts: mockPosts,
        metaData: { total: 1, offset: 0 },
      });

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, mockColumnSettingsMap, callback);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const record = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records[0];
      // Turndown converts HTML to markdown
      expect(record.fields.richContent).toBe('# Heading\n\nParagraph with **bold** text');
    });

    it('should keep rich text as HTML when dataConverter is html', async () => {
      const mockPosts: DraftPost[] = [
        {
          _id: 'post1',
          richContent: {
            nodes: [
              {
                type: 'HEADING',
                id: 'heading1',
                nodes: [
                  {
                    type: 'TEXT',
                    id: 'text1',
                    nodes: [],
                    textData: {
                      text: 'Heading',
                      decorations: [],
                    },
                  },
                ],
                headingData: {
                  level: 1,
                },
              },
              {
                type: 'PARAGRAPH',
                id: 'para1',
                nodes: [
                  {
                    type: 'TEXT',
                    id: 'text2',
                    nodes: [],
                    textData: {
                      text: 'Paragraph',
                      decorations: [],
                    },
                  },
                ],
                paragraphData: {},
              },
            ],
          },
        },
      ];

      mockClient.draftPosts.listDraftPosts.mockResolvedValue({
        draftPosts: mockPosts,
        metaData: { total: 1, offset: 0 },
      });

      const columnSettingsMapWithHtml = {
        richContent: {
          dataConverter: 'html',
        },
      };

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, columnSettingsMapWithHtml, callback);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const record = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records[0];
      // Should keep HTML (with newline formatting from converter)
      expect(record.fields.richContent).toContain('<h1>Heading</h1>');
      expect(record.fields.richContent).toContain('<p>Paragraph</p>');
    });

    it('should keep rich text in Wix format when dataConverter is wix', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const wixRichContent = {
        nodes: [
          {
            type: 'PARAGRAPH',
            id: 'para1',
            nodes: [
              {
                type: 'TEXT',
                id: 'text1',
                nodes: [],
                textData: {
                  text: 'Test',
                  decorations: [],
                },
              },
            ],
            paragraphData: {},
          },
        ],
      } as any;

      const mockPosts: DraftPost[] = [
        {
          _id: 'post1',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          richContent: wixRichContent,
        },
      ];

      mockClient.draftPosts.listDraftPosts.mockResolvedValue({
        draftPosts: mockPosts,
        metaData: { total: 1, offset: 0 },
      });

      const columnSettingsMapWithWix = {
        richContent: {
          dataConverter: 'wix',
        },
      };

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, columnSettingsMapWithWix, callback);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const record = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records[0];
      // Should keep Wix format as-is (stringified)
      expect(record.fields.richContent).toEqual(wixRichContent);
    });

    it('should handle empty posts array', async () => {
      mockClient.draftPosts.listDraftPosts.mockResolvedValue({
        draftPosts: [],
        metaData: {
          total: 0,
          offset: 0,
        },
      });

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, mockColumnSettingsMap, callback);

      expect(mockClient.draftPosts.listDraftPosts).toHaveBeenCalledTimes(1);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle pagination without metaData', async () => {
      // When metaData is undefined and we get exactly batch size, continue paginating
      const firstBatch: DraftPost[] = Array.from({ length: 100 }, (_, i) => ({
        _id: `post${i}`,
        title: `Post ${i}`,
      }));

      // Second batch is less than batch size, so pagination should stop
      const secondBatch: DraftPost[] = Array.from({ length: 50 }, (_, i) => ({
        _id: `post${i + 100}`,
        title: `Post ${i + 100}`,
      }));

      mockClient.draftPosts.listDraftPosts
        .mockResolvedValueOnce({
          draftPosts: firstBatch,
          metaData: undefined,
        })
        .mockResolvedValueOnce({
          draftPosts: secondBatch,
          metaData: undefined,
        });

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, mockColumnSettingsMap, callback);

      // Should stop when batch is less than limit
      expect(mockClient.draftPosts.listDraftPosts).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('displayName', () => {
    it('should return Wix Blog as display name', () => {
      expect(WixBlogConnector.displayName).toBe('Wix Blog');
    });
  });

  describe('service', () => {
    it('should have WIX_BLOG service type', () => {
      expect(connector.service).toBe(Service.WIX_BLOG);
    });
  });

  describe('getBatchSize', () => {
    it('should return 1 (Wix processes one at a time for writes)', () => {
      expect(connector.getBatchSize()).toBe(1);
    });
  });

  describe('listTables', () => {
    it('should return a single table for Blog Posts', async () => {
      const tables = await connector.listTables();

      expect(tables).toHaveLength(1);
      expect(tables[0]).toEqual({
        id: {
          wsId: 'wix_blog', // sanitizeForWsId converts 'wix-blog' to 'wix_blog'
          remoteId: ['wix-blog'],
        },
        displayName: 'Blog Posts',
      });
    });
  });

  describe('fetchTableSpec', () => {
    it('should fetch table spec with authors', async () => {
      const mockMembers = [
        {
          _id: 'member1',
          loginEmail: 'author1@example.com',
        },
        {
          _id: 'member2',
          loginEmail: 'author2@example.com',
        },
      ];

      mockClient.members.queryMembers.mockReturnValue({
        find: jest.fn().mockResolvedValue({
          items: mockMembers,
        }),
      });

      const tableSpec = await connector.fetchTableSpec();

      expect(tableSpec.name).toBe('Blog Posts');
      expect(tableSpec.columns).toBeDefined();
      expect(tableSpec.columns.length).toBeGreaterThan(0);
      expect(tableSpec.wixAuthors).toEqual([
        { id: 'member1', email: 'author1@example.com' },
        { id: 'member2', email: 'author2@example.com' },
      ]);
    });

    it('should handle no authors', async () => {
      mockClient.members.queryMembers.mockReturnValue({
        find: jest.fn().mockResolvedValue({
          items: [],
        }),
      });

      const tableSpec = await connector.fetchTableSpec();

      expect(tableSpec.wixAuthors).toEqual([]);
    });
  });

  describe('testConnection', () => {
    it('should successfully test connection', async () => {
      mockClient.draftPosts.listDraftPosts.mockResolvedValue({
        draftPosts: [],
      });

      await expect(connector.testConnection()).resolves.not.toThrow();

      expect(mockClient.draftPosts.listDraftPosts).toHaveBeenCalledWith({
        paging: { limit: 1, offset: 0 },
      });
    });

    it('should throw error on failed connection', async () => {
      mockClient.draftPosts.listDraftPosts.mockRejectedValue(new Error('Connection failed'));

      await expect(connector.testConnection()).rejects.toThrow('Connection failed');
    });
  });
});
