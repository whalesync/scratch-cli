import { Client } from '@notionhq/client';
import { Service } from '@prisma/client';
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
}
