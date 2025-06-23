import { Client, DatabaseObjectResponse } from '@notionhq/client';
import { Service } from '@prisma/client';
import { TableList } from '../../../connector-account/entities/table-list.entity';
import { Connector } from '../../connector';

export class NotionConnector extends Connector<typeof Service.NOTION> {
  private readonly client: Client;

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

  async listTables(): Promise<TableList> {
    const response = await this.client.search({
      filter: { property: 'object', value: 'database' },
    });

    const databases = response.results.filter((r) => r.object === 'database');
    const tables = databases.map((db: DatabaseObjectResponse) => ({
      name: db.title[0].plain_text,
      path: [db.id],
    }));
    return { tables };
  }
}
