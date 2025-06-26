import { Service } from '@prisma/client';
import { Connector } from '../../connector';
import { ColumnSpec, ConnectorRecord, EntityId, TablePreview, TableSpec } from '../../types';
import { AirtableApiClient } from './airtable-api-client';
import { AirtableSchemaParser } from './airtable-schema-parser';

export class AirtableConnector extends Connector<typeof Service.AIRTABLE> {
  service = Service.AIRTABLE;

  private readonly client: AirtableApiClient;
  private readonly schemaParser = new AirtableSchemaParser();

  constructor(apiKey: string) {
    super();
    this.client = new AirtableApiClient(apiKey);
  }

  public async testConnection(): Promise<void> {
    // Don't throw.
    await this.client.listBases();
  }

  async listTables(): Promise<TablePreview[]> {
    const bases = await this.client.listBases();
    const tables: TablePreview[] = [];
    for (const base of bases.bases) {
      const baseSchema = await this.client.getBaseSchema(base.id);
      tables.push(...baseSchema.tables.map((table) => this.schemaParser.parseTablePreview(base, table)));
    }
    return tables;
  }

  async fetchTableSpec(id: EntityId): Promise<TableSpec> {
    const [baseId, tableId] = id.remoteId;
    const baseSchema = await this.client.getBaseSchema(baseId);
    const table = baseSchema.tables.find((t) => t.id === tableId);
    if (!table) {
      throw new Error(`Table ${tableId} not found in base ${baseId}`);
    }
    const columns: ColumnSpec[] = [this.schemaParser.idColumn()];
    for (const field of table.fields) {
      columns.push(this.schemaParser.parseColumn(field));
    }
    return {
      id,
      name: table.name,
      columns,
    };
  }

  async downloadTableRecords(
    tableSpec: TableSpec,
    callback: (records: ConnectorRecord[]) => Promise<void>,
  ): Promise<void> {
    const [baseId, tableId] = tableSpec.id.remoteId;

    for await (const records of this.client.listRecords(baseId, tableId)) {
      await callback(this.translateRecords(records, tableSpec));
    }
  }

  // Record fields need to be keyed by the wsId, not the remoteId.
  private translateRecords(
    records: {
      id: string;
      fields: Record<string, unknown>;
    }[],
    tableSpec: TableSpec,
  ): ConnectorRecord[] {
    return records.map((r) => {
      const record: ConnectorRecord = {
        id: r.id,
      };
      for (const column of tableSpec.columns) {
        if (column.id.remoteId[0] in r.fields) {
          record[column.id.wsId] = r.fields[column.id.remoteId[0]];
        }
      }
      return record;
    });
  }
}
