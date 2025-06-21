import { Service } from '@prisma/client';
import { Table, TableList } from '../../../connector-account/entities/table-list.entity';
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

  async listTables(): Promise<TableList> {
    const bases = await this.client.listBases();
    const tables: Table[] = [];
    for (const base of bases.bases) {
      const baseSchema = await this.client.getBaseSchema(base.id);
      tables.push(
        ...baseSchema.tables.map((table) => ({
          name: `${base.name} - ${table.name}`,
          path: [base.id, table.id],
        })),
      );
    }
    return { tables };
  }
}
