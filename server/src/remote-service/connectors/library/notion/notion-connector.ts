import {
  APIErrorCode,
  APIResponseError,
  Client,
  DatabaseObjectResponse,
  PageObjectResponse,
  RequestTimeoutError,
} from '@notionhq/client';
import { BlockObjectResponse, CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';
import { Type, type TSchema } from '@sinclair/typebox';
import { Service } from '@spinner/shared-types';
import _ from 'lodash';
import { WSLogger } from 'src/logger';
import type { SnapshotColumnSettingsMap } from '../../../../workbook/types';
import { Connector } from '../../connector';
import { ErrorMessageTemplates } from '../../error';
import { sanitizeForTableWsId } from '../../ids';
import { BaseJsonTableSpec, ConnectorErrorDetails, ConnectorFile, EntityId, TablePreview } from '../../types';
import { createNotionBlockDiff } from './conversion/notion-block-diff';
import { NotionBlockDiffExecutor } from './conversion/notion-block-diff-executor';
import { NotionMarkdownConverter } from './conversion/notion-markdown-converter';
import { convertToNotionBlocks } from './conversion/notion-rich-text-push';
import { ConvertedNotionBlock } from './conversion/notion-rich-text-push-types';
import { NotionSchemaParser } from './notion-schema-parser';

export const PAGE_CONTENT_COLUMN_NAME = 'Page Content';
export const PAGE_CONTENT_COLUMN_ID = 'WS_PAGE_CONTENT';

type NotionDownloadProgress = {
  nextCursor: string | undefined;
};

const page_size = Number(process.env.NOTION_PAGE_SIZE ?? 100);
export class NotionConnector extends Connector<typeof Service.NOTION, NotionDownloadProgress> {
  readonly service = Service.NOTION;
  static displayName = 'Notion';

  private readonly client: Client;
  private readonly schemaParser = new NotionSchemaParser();
  private readonly markdownConverter = new NotionMarkdownConverter();

  constructor(apiKey: string) {
    super();
    this.client = new Client({ auth: apiKey });
  }

  async testConnection(): Promise<void> {
    // Just don't throw.
    await this.client.search({
      filter: { property: 'object', value: 'database' },
      page_size: 1,
    });
  }

  /**
   * Recursively fetches all blocks from a page, including nested children
   */
  private async fetchBlocksWithChildren(blockId: string): Promise<ConvertedNotionBlock[]> {
    const blocks: ConvertedNotionBlock[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      const response = await this.client.blocks.children.list({
        block_id: blockId,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const block of response.results) {
        // Add children property to match ConvertedNotionBlock type
        const blockWithChildren = {
          ...block,
          children: [] as ConvertedNotionBlock[],
        } as ConvertedNotionBlock;

        if (_.has(block, 'has_children') && (block as BlockObjectResponse).has_children) {
          blockWithChildren.children = await this.fetchBlocksWithChildren(block.id);
        }

        blocks.push(blockWithChildren);
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    return blocks;
  }

  async listTables(): Promise<TablePreview[]> {
    const response = await this.client.search({
      filter: { property: 'object', value: 'database' },
    });

    const databases = response.results.filter((r): r is DatabaseObjectResponse => r.object === 'database');
    const databaseTables = databases.map((db) => this.schemaParser.parseDatabaseTablePreview(db));
    return databaseTables;
  }

  /**
   * Fetch JSON Table Spec for Notion database pages.
   * Returns a schema describing the raw Notion page API response format.
   */
  async fetchJsonTableSpec(id: EntityId): Promise<BaseJsonTableSpec> {
    const [databaseId] = id.remoteId;
    const database = (await this.client.databases.retrieve({ database_id: databaseId })) as DatabaseObjectResponse;

    // Build schema for properties based on the database schema
    const propertySchemas: Record<string, TSchema> = {};
    let titleColumnRemoteId: EntityId['remoteId'] | undefined;

    for (const [name, property] of Object.entries(database.properties)) {
      const propSchema = this.notionPropertyToJsonSchema(property);
      propertySchemas[name] = Type.Optional(propSchema);

      // Track title property
      if (property.type === 'title') {
        titleColumnRemoteId = [databaseId, property.id];
      }
    }

    const tableTitle = database.title.map((t) => t.plain_text).join('');

    // Build schema for Notion page response
    const schema = Type.Object(
      {
        object: Type.Literal('page', { description: 'Object type' }),
        id: Type.String({ description: 'Unique page identifier' }),
        created_time: Type.String({ description: 'Page creation time', format: 'date-time' }),
        last_edited_time: Type.String({ description: 'Last edit time', format: 'date-time' }),
        created_by: Type.Object(
          {
            object: Type.Literal('user'),
            id: Type.String(),
          },
          { description: 'User who created the page' },
        ),
        last_edited_by: Type.Object(
          {
            object: Type.Literal('user'),
            id: Type.String(),
          },
          { description: 'User who last edited the page' },
        ),
        cover: Type.Optional(
          Type.Union([
            Type.Object({
              type: Type.Literal('external'),
              external: Type.Object({ url: Type.String({ format: 'uri' }) }),
            }),
            Type.Object({
              type: Type.Literal('file'),
              file: Type.Object({ url: Type.String({ format: 'uri' }), expiry_time: Type.String() }),
            }),
            Type.Null(),
          ]),
        ),
        icon: Type.Optional(
          Type.Union([
            Type.Object({
              type: Type.Literal('emoji'),
              emoji: Type.String(),
            }),
            Type.Object({
              type: Type.Literal('external'),
              external: Type.Object({ url: Type.String({ format: 'uri' }) }),
            }),
            Type.Object({
              type: Type.Literal('file'),
              file: Type.Object({ url: Type.String({ format: 'uri' }), expiry_time: Type.String() }),
            }),
            Type.Null(),
          ]),
        ),
        parent: Type.Object(
          {
            type: Type.Literal('database_id'),
            database_id: Type.String(),
          },
          { description: 'Parent database reference' },
        ),
        archived: Type.Boolean({ description: 'Is page archived' }),
        in_trash: Type.Optional(Type.Boolean({ description: 'Is page in trash' })),
        properties: Type.Object(propertySchemas, { description: 'Page properties' }),
        url: Type.String({ description: 'Page URL', format: 'uri' }),
        public_url: Type.Optional(Type.Union([Type.String({ format: 'uri' }), Type.Null()])),
      },
      {
        $id: `notion/${databaseId}`,
        title: tableTitle,
      },
    );

    return {
      id,
      slug: id.wsId,
      name: sanitizeForTableWsId(tableTitle),
      schema,
      idColumnRemoteId: 'id',
      titleColumnRemoteId,
      // Note: Page content (blocks) is not included in the raw page response
      // It would require separate block API calls
    };
  }

  /**
   * Convert a Notion database property to a TypeBox JSON Schema.
   */
  private notionPropertyToJsonSchema(property: DatabaseObjectResponse['properties'][string]): TSchema {
    const description = property.name;

    switch (property.type) {
      case 'title':
        return Type.Array(
          Type.Object({
            type: Type.String(),
            text: Type.Optional(Type.Object({ content: Type.String(), link: Type.Optional(Type.Unknown()) })),
            plain_text: Type.String(),
            href: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          }),
          { description },
        );

      case 'rich_text':
        return Type.Array(
          Type.Object({
            type: Type.String(),
            text: Type.Optional(Type.Object({ content: Type.String(), link: Type.Optional(Type.Unknown()) })),
            plain_text: Type.String(),
            href: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          }),
          { description },
        );

      case 'number':
        return Type.Union([Type.Number(), Type.Null()], { description });

      case 'select':
        return Type.Union(
          [
            Type.Object({
              id: Type.String(),
              name: Type.String(),
              color: Type.String(),
            }),
            Type.Null(),
          ],
          { description },
        );

      case 'multi_select':
        return Type.Array(
          Type.Object({
            id: Type.String(),
            name: Type.String(),
            color: Type.String(),
          }),
          { description },
        );

      case 'status':
        return Type.Union(
          [
            Type.Object({
              id: Type.String(),
              name: Type.String(),
              color: Type.String(),
            }),
            Type.Null(),
          ],
          { description },
        );

      case 'date':
        return Type.Union(
          [
            Type.Object({
              start: Type.String({ format: 'date-time' }),
              end: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
              time_zone: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            }),
            Type.Null(),
          ],
          { description },
        );

      case 'people':
        return Type.Array(
          Type.Object({
            object: Type.Literal('user'),
            id: Type.String(),
            name: Type.Optional(Type.String()),
            avatar_url: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            type: Type.Optional(Type.String()),
            person: Type.Optional(Type.Object({ email: Type.Optional(Type.String()) })),
          }),
          { description },
        );

      case 'files':
        return Type.Array(
          Type.Union([
            Type.Object({
              name: Type.String(),
              type: Type.Literal('external'),
              external: Type.Object({ url: Type.String({ format: 'uri' }) }),
            }),
            Type.Object({
              name: Type.String(),
              type: Type.Literal('file'),
              file: Type.Object({ url: Type.String({ format: 'uri' }), expiry_time: Type.String() }),
            }),
          ]),
          { description },
        );

      case 'checkbox':
        return Type.Boolean({ description });

      case 'url':
        return Type.Union([Type.String({ format: 'uri' }), Type.Null()], { description });

      case 'email':
        return Type.Union([Type.String({ format: 'email' }), Type.Null()], { description });

      case 'phone_number':
        return Type.Union([Type.String(), Type.Null()], { description });

      case 'formula':
        return Type.Union(
          [
            Type.Object({ type: Type.Literal('string'), string: Type.Union([Type.String(), Type.Null()]) }),
            Type.Object({ type: Type.Literal('number'), number: Type.Union([Type.Number(), Type.Null()]) }),
            Type.Object({ type: Type.Literal('boolean'), boolean: Type.Boolean() }),
            Type.Object({
              type: Type.Literal('date'),
              date: Type.Union([Type.Object({ start: Type.String(), end: Type.Optional(Type.String()) }), Type.Null()]),
            }),
          ],
          { description },
        );

      case 'relation':
        return Type.Array(Type.Object({ id: Type.String() }), { description });

      case 'rollup':
        return Type.Object(
          {
            type: Type.String(),
            function: Type.String(),
            number: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
            date: Type.Optional(Type.Unknown()),
            array: Type.Optional(Type.Array(Type.Unknown())),
          },
          { description },
        );

      case 'created_time':
        return Type.String({ description, format: 'date-time' });

      case 'created_by':
        return Type.Object(
          {
            object: Type.Literal('user'),
            id: Type.String(),
            name: Type.Optional(Type.String()),
            avatar_url: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          },
          { description },
        );

      case 'last_edited_time':
        return Type.String({ description, format: 'date-time' });

      case 'last_edited_by':
        return Type.Object(
          {
            object: Type.Literal('user'),
            id: Type.String(),
            name: Type.Optional(Type.String()),
            avatar_url: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          },
          { description },
        );

      default:
        return Type.Unknown({ description });
    }
  }

  public pullRecordDeep = undefined;

  async pullRecordFiles(
    tableSpec: BaseJsonTableSpec,
    callback: (params: { files: ConnectorFile[]; connectorProgress?: NotionDownloadProgress }) => Promise<void>,
    progress: NotionDownloadProgress,
  ): Promise<void> {
    WSLogger.info({ source: 'NotionConnector', message: 'pullRecordFiles called', tableId: tableSpec.id.wsId });

    const [databaseId] = tableSpec.id.remoteId;
    let hasMore = true;
    let nextCursor = progress?.nextCursor;

    while (hasMore) {
      const response = await this.client.databases.query({
        database_id: databaseId,
        start_cursor: nextCursor,
        page_size,
      });

      // Return raw page objects as ConnectorFiles
      const files: ConnectorFile[] = [];
      const pageResults = response.results.filter((r): r is PageObjectResponse => r.object === 'page');

      for (const page of pageResults) {
        const connectorFile = page as unknown as ConnectorFile;
        // Fetch children recursively for this page
        try {
          const childrenData = await this.pollRecordPageContentChildren(
            page.id,
            NotionConnector.PAGE_CONTENT_MAX_DEPTH,
            page.id,
          );
          connectorFile['page_content'] = childrenData.children;
        } catch (error) {
          WSLogger.error({
            source: 'NotionConnector',
            message: `Failed to fetch content for page ${page.id}`,
            error,
          });
        }
        files.push(connectorFile);
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor ?? undefined;

      await callback({
        files,
        connectorProgress: { nextCursor },
      });
    }
  }

  getBatchSize(): number {
    return 1;
  }

  /**
   * Create pages in Notion from raw JSON files.
   * Files should contain Notion properties in the raw API format.
   * Returns the created pages.
   */
  async createRecords(
    tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<ConnectorFile[]> {
    const results: ConnectorFile[] = [];
    const databaseId = tableSpec.id.remoteId[0];

    for (const file of files) {
      const rawProperties = (file.properties as Record<string, unknown>) || {};
      // Transform properties from read format to create format (same rules as update)
      const properties = this.transformPropertiesForUpdate(rawProperties);

      const newPage = await this.client.pages.create({
        parent: { database_id: databaseId },
        properties: properties as CreatePageParameters['properties'],
      });
      results.push(newPage as unknown as ConnectorFile);
    }

    return results;
  }

  // ==========================================
  // Recursive Fetching Logic
  // ==========================================

  private static readonly PAGE_CONTENT_MAX_DEPTH = 10;
  private static readonly PAGE_CONTENT_MAX_BREADTH = 500;
  private static readonly PAGE_CONTENT_PAGE_SIZE = 100;

  /**
   * Fetches the full content of a block (including recursive children).
   * Acts as the entry point for recursive fetching.
   */
  async pollRecordPageContent(blockId: string): Promise<{
    pageContent: ConvertedNotionBlock;
    statistics: { maxDepth: number; maxBreadth: number; totalCalls: number };
  }> {
    const response = await this.client.blocks.retrieve({ block_id: blockId });
    const pageContent = response as unknown as ConvertedNotionBlock;

    if (_.has(response, 'has_children') && (response as BlockObjectResponse).has_children) {
      const childrenData = await this.pollRecordPageContentChildren(
        pageContent.id!,
        NotionConnector.PAGE_CONTENT_MAX_DEPTH,
        blockId,
      );

      pageContent.children = childrenData.children;
      return {
        pageContent,
        statistics: {
          maxDepth: childrenData.statistics.maxDepth + 1,
          maxBreadth: Math.max(childrenData.statistics.maxBreadth, 1),
          totalCalls: childrenData.statistics.totalCalls + 1,
        },
      };
    }

    return { pageContent, statistics: { maxDepth: 1, maxBreadth: 1, totalCalls: 1 } };
  }

  /**
   * Recursively fetches children of a block, respecting depth and breadth limits.
   */
  async pollRecordPageContentChildren(
    blockId: string,
    depthLimit: number,
    rootRecordId: string,
  ): Promise<{
    children: ConvertedNotionBlock[];
    statistics: { maxDepth: number; maxBreadth: number; totalCalls: number };
  }> {
    if (depthLimit === 0) {
      WSLogger.warn({
        source: 'NotionConnector',
        message: `Max depth reached for record ${rootRecordId}`,
      });
      return { children: [], statistics: { maxDepth: 0, maxBreadth: 0, totalCalls: 0 } };
    }

    const blocks: ConvertedNotionBlock[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;
    let childMaxDepth = 0;
    let childMaxBreadth = 0;
    let totalCalls = 0;

    while (hasMore) {
      totalCalls++;

      // Stop if breadth limit reached
      if (blocks.length >= NotionConnector.PAGE_CONTENT_MAX_BREADTH) {
        WSLogger.warn({
          source: 'NotionConnector',
          message: `Max breadth reached for record ${rootRecordId}`,
        });
        break;
      }

      const response = await this.client.blocks.children.list({
        block_id: blockId,
        start_cursor: startCursor,
        page_size: NotionConnector.PAGE_CONTENT_PAGE_SIZE,
      });

      for (const result of response.results) {
        const block = result as unknown as ConvertedNotionBlock;

        // Skip unsupported types if necessary

        if ((result as BlockObjectResponse).has_children) {
          const childrenData = await this.pollRecordPageContentChildren(block.id!, depthLimit - 1, rootRecordId);
          block.children = childrenData.children;
          childMaxDepth = Math.max(childrenData.statistics.maxDepth, childMaxDepth);
          childMaxBreadth = Math.max(childrenData.statistics.maxBreadth, childMaxBreadth);
          totalCalls += childrenData.statistics.totalCalls;
        }

        blocks.push(block);
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    return {
      children: blocks,
      statistics: {
        maxDepth: childMaxDepth + 1,
        maxBreadth: Math.max(childMaxBreadth, blocks.length),
        totalCalls,
      },
    };
  }

  /**
   * Read-only property types that cannot be updated via the Notion API.
   * These must be filtered out before sending an update request.
   */
  private static readonly READ_ONLY_PROPERTY_TYPES = new Set([
    'rollup',
    'formula',
    'created_time',
    'last_edited_time',
    'created_by',
    'last_edited_by',
    'unique_id',
    'verification',
  ]);

  /**
   * Transform properties from Notion's read format to update format.
   * - Removes read-only properties (rollup, formula, etc.)
   * - Removes the 'type' field from each property (required for update API)
   */
  private transformPropertiesForUpdate(properties: Record<string, unknown>): Record<string, unknown> {
    const transformed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(properties)) {
      if (!value || typeof value !== 'object') {
        continue;
      }

      const prop = value as Record<string, unknown>;
      const propType = prop.type as string;

      // Skip read-only properties
      if (NotionConnector.READ_ONLY_PROPERTY_TYPES.has(propType)) {
        continue;
      }

      // Create a copy without the 'type' and 'id' fields
      // The Notion update API expects just the property value, not the type wrapper
      const rest = Object.fromEntries(Object.entries(prop).filter(([k]) => k !== 'type' && k !== 'id'));

      // Only include if there's actual content to update
      if (Object.keys(rest).length > 0) {
        transformed[key] = rest;
      }
    }

    return transformed;
  }

  /**
   * Update pages in Notion from raw JSON files.
   * Files should have an 'id' field and the properties to update.
   */
  async updateRecords(
    _tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<void> {
    for (const file of files) {
      const pageId = file.id as string;
      const rawProperties = (file.properties as Record<string, unknown>) || {};

      // Transform properties from read format to update format
      const properties = this.transformPropertiesForUpdate(rawProperties);

      if (Object.keys(properties).length > 0) {
        await this.client.pages.update({
          page_id: pageId,
          properties: properties as CreatePageParameters['properties'],
        });
      }
    }
  }

  /**
   * Delete (archive) pages in Notion.
   * Files should have an 'id' field with the page ID to archive.
   */
  async deleteRecords(_tableSpec: BaseJsonTableSpec, files: ConnectorFile[]): Promise<void> {
    for (const file of files) {
      const pageId = file.id as string;
      await this.client.pages.update({
        page_id: pageId,
        archived: true,
      });
    }
  }

  private async updatePageContent(pageId: string, content: string, isMarkdown: boolean): Promise<void> {
    // Fetch existing blocks from the page
    const existingBlocksArray = await this.fetchBlocksWithChildren(pageId);

    // Wrap blocks in a NotionBlockObject structure for the diff function
    const existingBlocks = {
      id: pageId,
      type: 'page',
      object: 'block',
      children: existingBlocksArray,
    };

    // Convert new content (markdown/HTML) to Notion blocks
    const newBlocks = isMarkdown
      ? this.markdownConverter.markdownToNotion(content)
      : convertToNotionBlocks(content, false);

    // Create a diff between old and new blocks
    const diff = createNotionBlockDiff(existingBlocks, newBlocks, pageId);

    // Execute the diff operations using the executor
    const executor = new NotionBlockDiffExecutor(this.client);
    const idMappings = new Map<string, string>(diff.idMappings || []);
    await executor.executeOperations(pageId, diff.operations, idMappings);
  }

  /**
   * Evalutes the specific the error from the Notion client and return a ConnectorErrorDetails object.
   * @param error - The error to evaluate.
   * @returns A common object describing the error for the user.
   */
  extractConnectorErrorDetails(error: unknown): ConnectorErrorDetails {
    if (RequestTimeoutError.isRequestTimeoutError(error)) {
      return {
        userFriendlyMessage: ErrorMessageTemplates.API_TIMEOUT('Notion'),
        description: error instanceof Error ? error.message : String(error),
      };
    }

    if (APIResponseError.isAPIResponseError(error)) {
      const notionError = error;

      if (notionError.code === APIErrorCode.Unauthorized) {
        return {
          userFriendlyMessage: 'The credentials Scratch uses to communicate with Notion are no longer valid.',
          description: notionError.message,
        };
      }

      if (notionError.code === APIErrorCode.RateLimited) {
        return {
          userFriendlyMessage: ErrorMessageTemplates.API_QUOTA_EXCEEDED('Notion'),
          description: notionError.message,
        };
      }

      if (notionError.code === APIErrorCode.ObjectNotFound) {
        return {
          userFriendlyMessage: 'The Notion object you are trying to access does not exist.',
          description: notionError.message,
        };
      }

      if (notionError.code === APIErrorCode.InvalidRequest) {
        return {
          userFriendlyMessage: 'The request you are trying to make is invalid.',
          description: notionError.message,
        };
      }

      if (notionError.code === APIErrorCode.InternalServerError) {
        return {
          userFriendlyMessage: 'An internal server error occurred while connecting to Notion.',
          description: notionError.message,
        };
      }

      if (notionError.code === APIErrorCode.ServiceUnavailable) {
        return {
          userFriendlyMessage: 'The Notion service is unavailable. Please try again later.',
          description: notionError.message,
        };
      }
    }
    return {
      userFriendlyMessage: 'An unexpected error occurred while connecting to Notion',
      description: error instanceof Error ? error.message : String(error),
    };
  }
}
