import { Service } from '@prisma/client';
import { Connector } from '../../connector';
import { AirtableApiClient } from './airtable-api-client';

export class AirtableConnector extends Connector<typeof Service.AIRTABLE> {
  service = Service.AIRTABLE;

  private readonly client: AirtableApiClient;

  constructor(apiKey: string) {
    super();
    this.client = new AirtableApiClient(apiKey);
  }

  public async testConnection(): Promise<void> {
    // Don't throw.
    await this.client.listBases();
  }
}
