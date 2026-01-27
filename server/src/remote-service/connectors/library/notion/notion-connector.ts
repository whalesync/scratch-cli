/* eslint-disable @typescript-eslint/no-base-to-string */ // TODO REMOVE.
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
import { MarkdownErrors } from '../../markdown-errors';
import {
  BaseJsonTableSpec,
  ConnectorErrorDetails,
  ConnectorFile,
  ConnectorRecord,
  EntityId,
  PostgresColumnType,
  TablePreview,
} from '../../types';
import { NotionColumnSpec, NotionTableSpec } from '../custom-spec-registry';
import { createNotionBlockDiff } from './conversion/notion-block-diff';
import { NotionBlockDiffExecutor } from './conversion/notion-block-diff-executor';
import { NotionMarkdownConverter } from './conversion/notion-markdown-converter';
import { convertNotionBlockObjectToHtmlv2 } from './conversion/notion-rich-text-conversion';
import { convertToNotionBlocks } from './conversion/notion-rich-text-push';
import { ConvertedNotionBlock } from './conversion/notion-rich-text-push-types';
import { NotionSchemaParser } from './notion-schema-parser';
import { PageObjectResponsePropertyTypes } from './property-types';

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

  async fetchTableSpec(id: EntityId): Promise<NotionTableSpec> {
    const [databaseId] = id.remoteId;
    const database = (await this.client.databases.retrieve({ database_id: databaseId })) as DatabaseObjectResponse;
    const columns: NotionColumnSpec[] = [];
    for (const property of Object.values(database.properties)) {
      columns.push(this.schemaParser.parseColumn(property));
    }
    //manually add a column to store page content in Markdown format
    columns.push({
      id: {
        wsId: PAGE_CONTENT_COLUMN_ID,
        remoteId: [PAGE_CONTENT_COLUMN_ID],
      },
      name: 'Page Content',
      pgType: PostgresColumnType.TEXT,
      dataConverterTypes: ['html'],
      notionDataType: 'rich_text',
      metadata: {
        textFormat: 'rich_text',
      },
    });

    let titleColumnRemoteId: string[] | undefined = undefined;

    const titleColumn = columns.find((c) => c.notionDataType === 'title');
    if (titleColumn) {
      titleColumnRemoteId = titleColumn.id.remoteId;
    } else {
      // look for the first column named title or name
      titleColumnRemoteId = columns.find((c) => c.name.toLowerCase() === 'title' || c.name.toLowerCase() === 'name')?.id
        .remoteId;
    }

    const tableTitle = database.title.map((t) => t.plain_text).join('');
    return {
      id,
      slug: id.wsId,
      name: sanitizeForTableWsId(tableTitle),
      columns,
      // Auto-set the page content column as the main content column for Notion tables
      mainContentColumnRemoteId: [PAGE_CONTENT_COLUMN_ID],
      titleColumnRemoteId: titleColumnRemoteId ? titleColumnRemoteId : undefined,
    };
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

  async downloadTableRecords(
    tableSpec: NotionTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
    callback: (params: { records: ConnectorRecord[]; connectorProgress?: NotionDownloadProgress }) => Promise<void>,
    progress?: NotionDownloadProgress,
  ): Promise<void> {
    const [databaseId] = tableSpec.id.remoteId;
    const notionDownloadProgress = (progress ?? {}) as NotionDownloadProgress;
    let hasMore = true;
    let nextCursor = notionDownloadProgress.nextCursor;
    while (hasMore) {
      const response = await this.client.databases.query({
        database_id: databaseId,
        start_cursor: nextCursor,
        page_size,
      });
      const records = await Promise.all(
        response.results
          .filter((r): r is PageObjectResponse => r.object === 'page')
          .map(async (page) => {
            const converted: ConnectorRecord = {
              id: page.id,
              fields: {},
            };

            for (const column of tableSpec.columns) {
              const prop = Object.values(page.properties).find((p) => p.id === column.id.remoteId[0]);
              if (prop) {
                converted.fields[column.id.wsId] = this.extractPropertyValue(prop);
              }
            }
            const pageContentColumn = tableSpec.columns.find((c) => c.id.wsId === PAGE_CONTENT_COLUMN_ID);
            if (pageContentColumn) {
              try {
                // Check what data converter the user wants for this column
                const dataConverter = columnSettingsMap[pageContentColumn.id.wsId]?.dataConverter;
                const blocks = await this.fetchBlocksWithChildren(page.id);

                if (dataConverter === 'html') {
                  // Convert to HTML using the old method
                  let htmlContent = '';
                  for (const block of blocks) {
                    const blockHtml = convertNotionBlockObjectToHtmlv2(block);
                    htmlContent += blockHtml;
                  }
                  converted.fields[pageContentColumn.id.wsId] = htmlContent;
                } else {
                  // Convert to Markdown using the new converter
                  const markdownContent = this.markdownConverter.notionToMarkdown(blocks);
                  converted.fields[pageContentColumn.id.wsId] = markdownContent;

                  // Extract data loss errors from the markdown
                  converted.errors = MarkdownErrors.extractAllDataLossErrors(
                    markdownContent,
                    pageContentColumn.id.wsId,
                    converted.errors,
                  );
                }
              } catch (e) {
                converted.fields[pageContentColumn.id.wsId] = 'Unable to convert this page content';
                WSLogger.error({
                  source: 'NotionConnector',
                  message: 'Error converting page content',
                  error: e,
                  pageId: page.id,
                });
              }
            }

            return converted;
          }),
      );

      hasMore = response.has_more;
      nextCursor = response.next_cursor ?? undefined;

      await callback({
        records,
        connectorProgress: { nextCursor },
      });
    }
  }

  public downloadRecordDeep = undefined;

  async downloadRecordFiles(
    tableSpec: BaseJsonTableSpec,
    callback: (params: { files: ConnectorFile[]; connectorProgress?: NotionDownloadProgress }) => Promise<void>,
    progress: NotionDownloadProgress,
  ): Promise<void> {
    WSLogger.info({ source: 'NotionConnector', message: 'downloadRecordFiles called', tableId: tableSpec.id.wsId });

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
      const files = response.results
        .filter((r): r is PageObjectResponse => r.object === 'page')
        .map((page) => page as unknown as ConnectorFile);

      hasMore = response.has_more;
      nextCursor = response.next_cursor ?? undefined;

      await callback({
        files,
        connectorProgress: { nextCursor },
      });
    }
  }

  private extractPropertyValue(
    property: PageObjectResponsePropertyTypes,
  ): string | number | boolean | Date | null | string[] {
    switch (property.type) {
      case 'title':
        return property.title.map((t) => t.plain_text).join('');
      case 'rich_text':
        return property.rich_text.map((t) => t.plain_text).join('');
      case 'number':
        return property.number;
      case 'select':
        return property.select?.name ?? null;
      case 'multi_select':
        return property.multi_select?.map((o) => o.name);
      case 'status':
        return property.status?.name ?? null;
      case 'date':
        // dates from Notion are in ISO 8601 format in UTC
        return property.date?.start ? new Date(property.date.start) : null;
      case 'people':
        return property.people.map((p) => p.id).join(', ');
      case 'files':
        return property.files.map((f) => f.name).join(', ');
      case 'checkbox':
        return property.checkbox;
      case 'url':
        return property.url;
      case 'email':
        return property.email;
      case 'phone_number':
        return property.phone_number;
      case 'formula':
        switch (property.formula.type) {
          case 'string':
            return property.formula.string;
          case 'number':
            return property.formula.number;
          case 'boolean':
            return property.formula.boolean;
          case 'date':
            // dates from Notion are in ISO 8601 format in UTC
            return property.formula.date?.start ? new Date(property.formula.date.start) : null;
          default:
            return null;
        }
      case 'relation':
        return property.relation.map((r) => r.id);
      case 'rollup':
        // TODO: This is more complicated.
        return null;
      case 'created_time':
        return property.created_time;
      case 'created_by':
        return property.created_by.id;
      case 'last_edited_time':
        return property.last_edited_time;
      case 'last_edited_by':
        return property.last_edited_by.id;
      case 'place':
        return property.place?.address || property.place?.name || '';
      case 'unique_id': {
        const { prefix, number } = property.unique_id;
        return prefix ? `${prefix}-${number}` : number;
      }
      case 'button':
        return '';
      default:
        return `Unsupported type: ${property.type}`;
    }
  }

  private buildNotionPropertyValue(
    type: string | undefined,
    value: unknown,
  ): CreatePageParameters['properties'][string] | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    switch (type) {
      case 'title':
        return { title: [{ text: { content: String(value) } }] };
      case 'rich_text':
        return { rich_text: [{ text: { content: String(value) } }] };
      case 'number':
        return { number: Number(value) };
      case 'select':
        return { select: { name: String(value) } };
      case 'multi_select':
        return { multi_select: Array.isArray(value) ? value.map((v) => ({ name: String(v) })) : [] };
      case 'status':
        return { status: { name: String(value) } };
      case 'date':
        // Notion expects dates to be in ISO 8601 format in UTC
        return { date: { start: value instanceof Date ? value.toISOString() : String(value) } };
      case 'checkbox':
        return { checkbox: Boolean(value) };
      case 'url':
        return { url: String(value) };
      case 'email':
        return { email: String(value) };
      case 'phone_number':
        return { phone_number: String(value) };
      case 'relation':
        return { relation: Array.isArray(value) ? value.map((id) => ({ id: String(id) })) : [] };
      case 'last_edited_by':
      case 'files':
      case 'people':
      default:
        return undefined;
    }
  }

  getBatchSize(): number {
    return 1;
  }

  async createRecords(
    tableSpec: NotionTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
    records: { wsId: string; fields: Record<string, unknown> }[],
  ): Promise<{ wsId: string; remoteId: string }[]> {
    const results: { wsId: string; remoteId: string }[] = [];
    let hasPageContentUpdate = false;
    let pageContentValue: string | undefined;

    for (const record of records) {
      const notionProperties: CreatePageParameters['properties'] = {};
      for (const [wsId, value] of Object.entries(record.fields)) {
        const column = tableSpec.columns.find((c) => c.id.wsId === wsId);
        if (column && !column.readonly) {
          if (wsId === PAGE_CONTENT_COLUMN_ID) {
            hasPageContentUpdate = true;
            pageContentValue = value as string;
          } else {
            const propertyId = column.id.remoteId[0];
            const propertyValue = this.buildNotionPropertyValue(column.notionDataType, value);
            if (propertyValue) {
              notionProperties[propertyId] = propertyValue;
            }
          }
        }
      }

      const newPage = await this.client.pages.create({
        parent: { database_id: tableSpec.id.remoteId[0] },
        properties: notionProperties,
      });

      // Update page content if needed
      if (hasPageContentUpdate && pageContentValue) {
        // Check if the data converter for this column is markdown
        const dataConverter = columnSettingsMap[PAGE_CONTENT_COLUMN_ID]?.dataConverter;
        // default to markdown if no data converter is set
        const isMarkdown = !dataConverter || dataConverter === 'markdown';
        await this.updatePageContent(newPage.id, pageContentValue, isMarkdown);
      }

      results.push({ wsId: record.wsId, remoteId: newPage.id });
    }

    return results;
  }

  async updateRecords(
    tableSpec: NotionTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
    records: { id: { wsId: string; remoteId: string }; partialFields: Record<string, unknown> }[],
  ): Promise<void> {
    for (const record of records) {
      const notionProperties: CreatePageParameters['properties'] = {};
      let hasPageContentUpdate = false;
      let pageContentValue: string | undefined;

      for (const [wsId, value] of Object.entries(record.partialFields)) {
        const column = tableSpec.columns.find((c) => c.id.wsId === wsId);
        if (column && !column.readonly) {
          if (wsId === PAGE_CONTENT_COLUMN_ID) {
            hasPageContentUpdate = true;
            pageContentValue = value as string;
          } else {
            const propertyId = column.id.remoteId[0];
            const propertyValue = this.buildNotionPropertyValue(column.notionDataType, value);
            if (propertyValue) {
              notionProperties[propertyId] = propertyValue;
            }
          }
        }
      }

      // Update regular properties first
      if (Object.keys(notionProperties).length > 0) {
        await this.client.pages.update({
          page_id: record.id.remoteId,
          properties: notionProperties,
        });
      }

      // Update page content if needed
      if (hasPageContentUpdate && pageContentValue) {
        // Check if the data converter for this column is markdown
        const dataConverter = columnSettingsMap[PAGE_CONTENT_COLUMN_ID]?.dataConverter;
        // default to markdown if no data converter is set
        const isMarkdown = !dataConverter || dataConverter === 'markdown';
        await this.updatePageContent(record.id.remoteId, pageContentValue, isMarkdown);
      }
    }
  }

  async deleteRecords(tableSpec: NotionTableSpec, recordIds: { wsId: string; remoteId: string }[]): Promise<void> {
    for (const recordId of recordIds) {
      await this.client.pages.update({
        page_id: recordId.remoteId,
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
