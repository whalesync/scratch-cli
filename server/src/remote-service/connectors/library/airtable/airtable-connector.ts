import { Service } from '@spinner/shared-types';
import { isAxiosError } from 'axios';
import _ from 'lodash';
import { JsonSafeObject } from 'src/utils/objects';
import type { SnapshotColumnSettingsMap } from 'src/workbook/types';
import { Connector } from '../../connector';
import { extractCommonDetailsFromAxiosError, extractErrorMessageFromAxiosError } from '../../error';
import { ConnectorErrorDetails, ConnectorRecord, EntityId, PostgresColumnType, TablePreview } from '../../types';
import { AirtableTableSpec } from '../custom-spec-registry';
import { AirtableApiClient } from './airtable-api-client';
import { AirtableSchemaParser } from './airtable-schema-parser';
import { AirtableRecord } from './airtable-types';

export class AirtableConnector extends Connector<typeof Service.AIRTABLE> {
  readonly service = Service.AIRTABLE;
  static readonly displayName = 'Airtable';

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

    const columns = table.fields.map((field) => this.schemaParser.parseColumn(field));

    // Find title column using Airtable's primaryFieldId
    const titleColumn = columns.find((col) => col.id.remoteId[1] === table.primaryFieldId);
    const titleColumnRemoteId = titleColumn?.id.remoteId;
    const titleColumnSlug = titleColumn?.slug;

    // Discover main content column
    const mainContentColumnRemoteId = this.schemaParser.discoverMainContentColumn(columns, titleColumnSlug);

    return {
      id,
      slug: id.wsId,
      name: table.name,
      columns,
      titleColumnRemoteId,
      mainContentColumnRemoteId,
    };
  }

  public downloadRecordDeep = undefined;

  async downloadTableRecords(
    tableSpec: AirtableTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
    callback: (params: { records: ConnectorRecord[]; connectorProgress?: JsonSafeObject }) => Promise<void>,
  ): Promise<void> {
    const [baseId, tableId] = tableSpec.id.remoteId;

    for await (const rawRecords of this.client.listRecords(baseId, tableId)) {
      const records = this.wireToConnectorRecord(rawRecords, tableSpec);
      await callback({ records });
    }
  }

  // Record fields need to be keyed by the wsId, not the remoteId.
  // Airtable returns fields keyed by field name (slug).
  private wireToConnectorRecord(records: AirtableRecord[], tableSpec: AirtableTableSpec): ConnectorRecord[] {
    return records.map((r) => {
      const record: ConnectorRecord = {
        id: r.id,
        fields: {},
      };
      for (const column of tableSpec.columns) {
        // Airtable uses field name as the key in response (like Webflow uses slug)
        if (!column.slug) {
          continue;
        }

        const fieldValue = r.fields[column.slug];
        if (fieldValue !== undefined) {
          if (column.pgType === PostgresColumnType.TIMESTAMP) {
            // dates should be sent to Airtable in ISO 8601 format in UTC
            record.fields[column.id.wsId] = fieldValue ? new Date(fieldValue as string) : null;
          } else {
            record.fields[column.id.wsId] = fieldValue;
          }
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
    columnSettingsMap: SnapshotColumnSettingsMap,
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
    _columnSettingsMap: SnapshotColumnSettingsMap,
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

  // Record fields need to be keyed by field name (slug), not the wsId.
  // Airtable accepts field names as keys when writing.
  private wsFieldsToAirtableFields(
    wsFields: Record<string, unknown>,
    tableSpec: AirtableTableSpec,
  ): Record<string, unknown> {
    const airtableFields: Record<string, unknown> = {};
    for (const column of tableSpec.columns) {
      if (column.id.wsId === 'id' || !column.slug) {
        continue;
      }
      const val = wsFields[column.id.wsId];
      if (val !== undefined) {
        if (column.pgType === PostgresColumnType.NUMERIC) {
          airtableFields[column.slug] = parseFloat(val as string);
        } else if (column.pgType === PostgresColumnType.TIMESTAMP) {
          // Airtable expects dates to be in ISO 8601 format in UTC
          airtableFields[column.slug] = val instanceof Date ? val.toISOString() : _.isString(val) ? val : undefined;
        } else {
          airtableFields[column.slug] = val;
        }
      }
    }
    return airtableFields;
  }

  extractConnectorErrorDetails(error: unknown): ConnectorErrorDetails {
    if (isAxiosError(error)) {
      const commonError = extractCommonDetailsFromAxiosError(this, error);
      if (commonError) return commonError;

      return {
        userFriendlyMessage: extractErrorMessageFromAxiosError(this.service, error),
        description: error.message,
        additionalContext: {
          status: error.response?.status,
        },
      };
    }
    return {
      userFriendlyMessage: 'An error occurred while connecting to Airtable',
      description: error instanceof Error ? error.message : String(error),
    };
  }
}
