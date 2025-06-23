import { Service } from '@prisma/client';
import { Connector } from '../../connector';
import { toPgFriendlyName } from '../../pg-helpers';
import { ConnectorRecord, TableListing, TablePath, TableSpec } from '../../types';
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

  async listTables(): Promise<TableListing[]> {
    const bases = await this.client.listBases();
    const tables: TableListing[] = [];
    for (const base of bases.bases) {
      const baseSchema = await this.client.getBaseSchema(base.id);
      tables.push(
        ...baseSchema.tables.map((table) => ({
          displayName: `${base.name} - ${table.name}`,
          connectorPath: [base.id, table.id],
        })),
      );
    }
    return tables;
  }

  async fetchTableSpec(connectorPath: TablePath): Promise<TableSpec> {
    const [baseId, tableId] = connectorPath;
    const baseSchema = await this.client.getBaseSchema(baseId);
    const table = baseSchema.tables.find((t) => t.id === tableId);
    if (!table) {
      throw new Error(`Table ${tableId} not found in base ${baseId}`);
    }
    return {
      pgName: toPgFriendlyName(table.name),
      connectorPath,
      columns: table.fields.map((field) => ({
        pgName: toPgFriendlyName(field.name),
        connectorId: field.id,
        type: 'text', // TODO: Pick a better type.
      })),
    };
  }

  async downloadTableRecords(tableSpec: TableSpec, callback: (records: ConnectorRecord[]) => void): Promise<void> {
    const [baseId, tableId] = tableSpec.connectorPath;

    for await (const records of this.client.listRecords(baseId, tableId)) {
      callback(
        records.map((r) => ({
          id: r.id,
          ...r.fields,
        })),
      );
    }
  }
}
