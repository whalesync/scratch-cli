import { Client, DatabaseObjectResponse, PageObjectResponse } from '@notionhq/client';
import { Service } from '@prisma/client';
import { Connector } from '../../connector';
import { sanitizeForWsId } from '../../ids';
import { ColumnSpec, ConnectorRecord, EntityId, TablePreview, TableSpec } from '../../types';
import { NotionSchemaParser } from './notion-schema-parser';

export class NotionConnector extends Connector<typeof Service.NOTION> {
  private readonly client: Client;
  private readonly schemaParser = new NotionSchemaParser();

  service = Service.NOTION;

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

  async listTables(): Promise<TablePreview[]> {
    const response = await this.client.search({
      filter: { property: 'object', value: 'database' },
    });

    const databases = response.results.filter((r): r is DatabaseObjectResponse => r.object === 'database');
    const tables = databases.map((db) => this.schemaParser.parseTablePreview(db));
    return tables;
  }

  async fetchTableSpec(id: EntityId): Promise<TableSpec> {
    const [databaseId] = id.remoteId;
    const database = (await this.client.databases.retrieve({ database_id: databaseId })) as DatabaseObjectResponse;
    const columns: ColumnSpec[] = [this.schemaParser.idColumn()];
    for (const property of Object.values(database.properties)) {
      columns.push(this.schemaParser.parseColumn(property));
    }
    const tableTitle = database.title.map((t) => t.plain_text).join('');
    return {
      id,
      name: sanitizeForWsId(tableTitle),
      columns,
    };
  }

  async downloadTableRecords(
    tableSpec: TableSpec,
    callback: (records: ConnectorRecord[]) => Promise<void>,
  ): Promise<void> {
    const [databaseId] = tableSpec.id.remoteId;

    let hasMore = true;
    let nextCursor: string | undefined = undefined;
    while (hasMore) {
      const response = await this.client.databases.query({
        database_id: databaseId,
        start_cursor: nextCursor,
      });
      const records = response.results
        .filter((r): r is PageObjectResponse => r.object === 'page')
        .map((page) => {
          const converted: ConnectorRecord = {
            id: page.id,
          };

          for (const column of tableSpec.columns) {
            const prop = Object.values(page.properties).find((p) => p.id === column.id.remoteId[0]);
            if (prop) {
              converted[column.id.wsId] = this.extractPropertyValue(prop);
            }
          }
          return converted;
        });
      await callback(records);

      hasMore = response.has_more;
      nextCursor = response.next_cursor ?? undefined;
    }
  }

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
}
