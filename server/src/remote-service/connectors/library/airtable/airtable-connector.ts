import { Service } from '@prisma/client';
import { Connector } from '../../connector';
import { ConnectorRecord, EntityId, PostgresColumnType, TablePreview } from '../../types';
import { AirtableTableSpec } from '../custom-spec-registry';
import { AirtableApiClient } from './airtable-api-client';
import { AirtableSchemaParser } from './airtable-schema-parser';
import { AirtableRecord } from './airtable-types';

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

  async fetchTableSpec(id: EntityId): Promise<AirtableTableSpec> {
    const [baseId, tableId] = id.remoteId;
    const baseSchema = await this.client.getBaseSchema(baseId);
    const table = baseSchema.tables.find((t) => t.id === tableId);
    if (!table) {
      throw new Error(`Table ${tableId} not found in base ${baseId}`);
    }

    // KLUDGE: hacky markdown support
    const markdown = table.name.endsWith('_md');

    return {
      id,
      name: table.name,
      columns: table.fields.map((field) => this.schemaParser.parseColumn(field)),
      markdownFiles: markdown,
    };
  }

  public downloadRecordDeep = undefined;

  async downloadTableRecords(
    tableSpec: AirtableTableSpec,
    callback: (records: ConnectorRecord[]) => Promise<void>,
  ): Promise<void> {
    const [baseId, tableId] = tableSpec.id.remoteId;

    for await (const records of this.client.listRecords(baseId, tableId)) {
      await callback(this.wireToConnectorRecord(records, tableSpec));
    }
  }

  // Record fields need to be keyed by the wsId, not the remoteId.
  private wireToConnectorRecord(records: AirtableRecord[], tableSpec: AirtableTableSpec): ConnectorRecord[] {
    return records.map((r) => {
      const record: ConnectorRecord = {
        id: r.id,
        fields: {},
      };
      for (const column of tableSpec.columns) {
        const val = column.id.remoteId[0];
        if (val !== undefined) {
          record.fields[column.id.wsId] = r.fields[val];
        }
      }
      return record;
    });
  }

  getBatchSize(): number {
    return 10;
  }

  async createRecords(
    tableSpec: AirtableTableSpec,
    records: { wsId: string; fields: Record<string, unknown> }[],
  ): Promise<{ wsId: string; remoteId: string }[]> {
    const [baseId, tableId] = tableSpec.id.remoteId;

    const airtableRecords = records.map((r) => this.wsFieldsToAirtableFields(r.fields, tableSpec));

    const created = await this.client.createRecords(
      baseId,
      tableId,
      airtableRecords.map((fields) => ({ fields })),
    );

    // Airtable returns records in the same order as the request, zip them to get the IDs.
    return records.map(({ wsId }, i) => ({ wsId, remoteId: created[i].id }));
  }

  async updateRecords(
    tableSpec: AirtableTableSpec,
    records: {
      id: { wsId: string; remoteId: string };
      partialFields: Record<string, unknown>;
    }[],
  ): Promise<void> {
    const [baseId, tableId] = tableSpec.id.remoteId;
    const airtableRecords = records.map((r) => {
      return {
        id: r.id.remoteId,
        fields: this.wsFieldsToAirtableFields(r.partialFields, tableSpec),
      };
    });
    await this.client.updateRecords(baseId, tableId, airtableRecords);
  }

  async deleteRecords(tableSpec: AirtableTableSpec, recordIds: { wsId: string; remoteId: string }[]): Promise<void> {
    const [baseId, tableId] = tableSpec.id.remoteId;
    await this.client.deleteRecords(
      baseId,
      tableId,
      recordIds.map((r) => r.remoteId),
    );
  }

  // Record fields need to be keyed by the remoteId, not the wsId.
  private wsFieldsToAirtableFields(
    wsFields: Record<string, unknown>,
    tableSpec: AirtableTableSpec,
  ): Record<string, unknown> {
    const airtableFields: Record<string, unknown> = {};
    for (const column of tableSpec.columns) {
      if (column.id.wsId === 'id') {
        continue;
      }
      const val = wsFields[column.id.wsId];
      if (val !== undefined) {
        if (column.pgType === PostgresColumnType.NUMERIC) {
          airtableFields[column.id.remoteId[0]] = parseFloat(val as string);
        } else {
          airtableFields[column.id.remoteId[0]] = val;
        }
      }
    }
    return airtableFields;
  }
}
