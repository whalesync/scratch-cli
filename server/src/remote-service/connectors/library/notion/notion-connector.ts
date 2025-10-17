/* eslint-disable @typescript-eslint/no-base-to-string */ // TODO REMOVE.
import { Client, DatabaseObjectResponse, PageObjectResponse } from '@notionhq/client';
import { BlockObjectRequest, CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';
import { ConnectorAccount, Service } from '@prisma/client';
import { NotionToMarkdown } from 'notion-to-md';
import { WSLogger } from 'src/logger';
import { Connector } from '../../connector';
import { sanitizeForWsId } from '../../ids';
import { ConnectorRecord, EntityId, PostgresColumnType, TablePreview } from '../../types';
import { NotionColumnSpec, NotionTableSpec } from '../custom-spec-registry';
import { NotionSchemaParser } from './notion-schema-parser';

export const PAGE_CONTENT_COLUMN_NAME = 'Page Content';
export const PAGE_CONTENT_COLUMN_ID = 'WS_PAGE_CONTENT';

type NotionDownloadProgress = {
  nextCursor: string | undefined;
};

const page_size = Number(process.env.NOTION_PAGE_SIZE ?? 100);
export class NotionConnector extends Connector<typeof Service.NOTION, NotionDownloadProgress> {
  private readonly client: Client;
  private readonly schemaParser = new NotionSchemaParser();
  private readonly markdownConverter: NotionToMarkdown;

  service = Service.NOTION;

  constructor(apiKey: string) {
    super();
    this.client = new Client({ auth: apiKey });
    this.markdownConverter = new NotionToMarkdown({
      notionClient: this.client,
      config: {
        parseChildPages: false,
      },
    });
  }

  async testConnection(): Promise<void> {
    // Just don't throw.
    await this.client.search({
      filter: { property: 'object', value: 'database' },
      page_size: 1,
    });
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
      notionDataType: 'rich_text',
      metadata: {
        textFormat: 'rich_text',
      },
    });

    const tableTitle = database.title.map((t) => t.plain_text).join('');
    return {
      id,
      name: sanitizeForWsId(tableTitle),
      columns,
    };
  }

  async downloadTableRecords(
    tableSpec: NotionTableSpec,
    callback: (params: { records: ConnectorRecord[]; connectorProgress?: NotionDownloadProgress }) => Promise<void>,
    account: ConnectorAccount,
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
                // do this separately to avoid blocking the main thread and killing the download
                const mdblocks = await this.markdownConverter.pageToMarkdown(page.id);
                const mdString = this.markdownConverter.toMarkdownString(mdblocks);
                let content = mdString['parent'];
                if (typeof content === 'string' && content.startsWith('\n')) {
                  content = content.replace(/^\n+/, '');
                }
                converted.fields[pageContentColumn.id.wsId] = content;
              } catch (e) {
                converted.fields[pageContentColumn.id.wsId] = 'Unable to convert this page content to markdown';
                WSLogger.error({
                  source: 'NotionConnector',
                  message: 'Error converting page content to markdown',
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

  private extractPropertyValue(
    property: PageObjectResponse['properties'][string],
  ): string | number | boolean | null | string[] {
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
        return property.date?.start ?? null;
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
            return property.formula.date?.start ?? null;
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
        return { date: { start: String(value) } }; // Assuming ISO 8601 string
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
    records: { wsId: string; fields: Record<string, unknown> }[],
  ): Promise<{ wsId: string; remoteId: string }[]> {
    const results: { wsId: string; remoteId: string }[] = [];

    for (const record of records) {
      const notionProperties: CreatePageParameters['properties'] = {};
      for (const [wsId, value] of Object.entries(record.fields)) {
        const column = tableSpec.columns.find((c) => c.id.wsId === wsId);
        if (column && !column.readonly) {
          const propertyId = column.id.remoteId[0];
          const propertyValue = this.buildNotionPropertyValue(column.notionDataType, value);
          if (propertyValue) {
            notionProperties[propertyId] = propertyValue;
          }
        }
      }

      const newPage = await this.client.pages.create({
        parent: { database_id: tableSpec.id.remoteId[0] },
        properties: notionProperties,
      });

      results.push({ wsId: record.wsId, remoteId: newPage.id });
    }

    return results;
  }

  async updateRecords(
    tableSpec: NotionTableSpec,
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
        await this.updatePageContent(record.id.remoteId, pageContentValue);
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

  private async updatePageContent(pageId: string, markdownContent: string): Promise<void> {
    try {
      // Clear existing page content
      await this.clearPageContent(pageId);

      // Convert markdown to Notion blocks and append them
      const blocks = this.convertMarkdownToNotionBlocks(markdownContent);
      if (blocks.length > 0) {
        await this.client.blocks.children.append({
          block_id: pageId,
          children: blocks,
        });
      }
    } catch (error) {
      WSLogger.error({
        source: 'NotionConnector',
        message: 'Error updating page content',
        error,
        pageId,
      });
      throw error;
    }
  }

  private async clearPageContent(pageId: string): Promise<void> {
    try {
      // Get all existing blocks
      const response = await this.client.blocks.children.list({
        block_id: pageId,
      });

      // Delete all existing blocks
      for (const block of response.results) {
        await this.client.blocks.delete({
          block_id: block.id,
        });
      }
    } catch (error) {
      WSLogger.error({
        source: 'NotionConnector',
        message: 'Error clearing page content',
        error,
        pageId,
      });
      throw error;
    }
  }

  private convertMarkdownToNotionBlocks(markdown: string): BlockObjectRequest[] {
    const lines = markdown.split('\n');
    const blocks: BlockObjectRequest[] = [];
    let currentParagraph: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine === '') {
        // Empty line - flush current paragraph if any
        if (currentParagraph.length > 0) {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: currentParagraph.join('\n') } }],
            },
          });
          currentParagraph = [];
        }
      } else if (trimmedLine.startsWith('# ')) {
        // H1 heading
        if (currentParagraph.length > 0) {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: currentParagraph.join('\n') } }],
            },
          });
          currentParagraph = [];
        }
        blocks.push({
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ type: 'text', text: { content: trimmedLine.substring(2) } }],
          },
        });
      } else if (trimmedLine.startsWith('## ')) {
        // H2 heading
        if (currentParagraph.length > 0) {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: currentParagraph.join('\n') } }],
            },
          });
          currentParagraph = [];
        }
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: trimmedLine.substring(3) } }],
          },
        });
      } else if (trimmedLine.startsWith('### ')) {
        // H3 heading
        if (currentParagraph.length > 0) {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: currentParagraph.join('\n') } }],
            },
          });
          currentParagraph = [];
        }
        blocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ type: 'text', text: { content: trimmedLine.substring(4) } }],
          },
        });
      } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        // Bullet list item
        if (currentParagraph.length > 0) {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: currentParagraph.join('\n') } }],
            },
          });
          currentParagraph = [];
        }
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: trimmedLine.substring(2) } }],
          },
        });
      } else if (/^\d+\.\s/.test(trimmedLine)) {
        // Numbered list item
        if (currentParagraph.length > 0) {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: currentParagraph.join('\n') } }],
            },
          });
          currentParagraph = [];
        }
        const content = trimmedLine.replace(/^\d+\.\s/, '');
        blocks.push({
          object: 'block',
          type: 'numbered_list_item',
          numbered_list_item: {
            rich_text: [{ type: 'text', text: { content } }],
          },
        });
      } else {
        // Regular paragraph line
        currentParagraph.push(line);
      }
    }

    // Flush any remaining paragraph content
    if (currentParagraph.length > 0) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: currentParagraph.join('\n') } }],
        },
      });
    }

    return blocks;
  }
}
