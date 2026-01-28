import { Type, type TSchema } from '@sinclair/typebox';
import { Service } from '@spinner/shared-types';
import { isAxiosError } from 'axios';
import _ from 'lodash';
import { JsonSafeObject } from 'src/utils/objects';
import type { SnapshotColumnSettingsMap } from 'src/workbook/types';
import { Connector } from '../../connector';
import { extractCommonDetailsFromAxiosError, extractErrorMessageFromAxiosError } from '../../error';
import {
  BaseJsonTableSpec,
  ConnectorErrorDetails,
  ConnectorFile,
  ConnectorRecord,
  EntityId,
  PostgresColumnType,
  TablePreview,
} from '../../types';
import { AirtableTableSpec } from '../custom-spec-registry';
import { AirtableApiClient } from './airtable-api-client';
import { AirtableSchemaParser } from './airtable-schema-parser';
import { AirtableDataType, AirtableFieldsV2, AirtableRecord } from './airtable-types';

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

  /**
   * Fetch JSON Table Spec directly from the Airtable API for a table.
   * Returns a schema that describes the raw Airtable record format:
   * { id: string, fields: { ... }, createdTime: string }
   */
  async fetchJsonTableSpec(id: EntityId): Promise<BaseJsonTableSpec> {
    const [baseId, tableId] = id.remoteId;
    const baseSchema = await this.client.getBaseSchema(baseId);
    const table = baseSchema.tables.find((t) => t.id === tableId);
    if (!table) {
      throw new Error(`Table ${tableId} not found in base ${baseId}`);
    }

    // Build schema for the fields object
    const fieldProperties: Record<string, TSchema> = {};
    let titleColumnRemoteId: EntityId['remoteId'] | undefined;
    let mainContentColumnRemoteId: EntityId['remoteId'] | undefined;

    for (const field of table.fields) {
      const fieldSchema = this.airtableFieldToJsonSchema(field);
      // All Airtable fields are optional in the response (can be missing if empty)
      fieldProperties[field.name] = Type.Optional(fieldSchema);

      // Track title column (primary field)
      if (field.id === table.primaryFieldId) {
        titleColumnRemoteId = [baseId, tableId, field.id];
      }

      // Track main content column (first rich text field)
      if (!mainContentColumnRemoteId && (field.type as AirtableDataType) === AirtableDataType.RICH_TEXT) {
        mainContentColumnRemoteId = [baseId, tableId, field.id];
      }
    }

    // Airtable raw record schema: { id, fields, createdTime }
    const schema = Type.Object(
      {
        id: Type.String({ description: 'Unique record identifier' }),
        fields: Type.Object(fieldProperties, { description: 'Record field values keyed by field name' }),
        createdTime: Type.String({ description: 'ISO 8601 timestamp of record creation', format: 'date-time' }),
      },
      {
        $id: `${baseId}/${tableId}`,
        title: table.name,
      },
    );

    return {
      id,
      slug: id.wsId,
      name: table.name,
      schema,
      idColumnRemoteId: 'id',
      titleColumnRemoteId,
      mainContentColumnRemoteId,
    };
  }

  /**
   * Convert an Airtable field to a TypeBox JSON Schema.
   */
  private airtableFieldToJsonSchema(field: AirtableFieldsV2): TSchema {
    const description = field.description || field.name;

    switch (field.type as AirtableDataType) {
      case AirtableDataType.SINGLE_LINE_TEXT:
      case AirtableDataType.MULTILINE_TEXT:
      case AirtableDataType.PHONE_NUMBER:
      case AirtableDataType.BARCODE:
        return Type.String({ description });

      case AirtableDataType.EMAIL:
        return Type.String({ description, format: 'email' });

      case AirtableDataType.URL:
        return Type.String({ description, format: 'uri' });

      case AirtableDataType.RICH_TEXT:
        return Type.String({ description, contentMediaType: 'text/markdown' });

      case AirtableDataType.NUMBER:
      case AirtableDataType.PERCENT:
      case AirtableDataType.CURRENCY:
      case AirtableDataType.DURATION:
      case AirtableDataType.RATING:
        return Type.Number({ description });

      case AirtableDataType.AUTO_NUMBER:
      case AirtableDataType.COUNT:
        return Type.Integer({ description });

      case AirtableDataType.CHECKBOX:
        return Type.Boolean({ description });

      case AirtableDataType.DATE:
        return Type.String({ description, format: 'date' });

      case AirtableDataType.DATE_TIME:
      case AirtableDataType.CREATED_TIME:
      case AirtableDataType.LAST_MODIFIED_TIME:
        return Type.String({ description, format: 'date-time' });

      case AirtableDataType.SINGLE_SELECT:
        return Type.Union([Type.String(), Type.Null()], { description });

      case AirtableDataType.MULTIPLE_SELECTS:
      case AirtableDataType.MULTIPLE_RECORD_LINKS:
      case AirtableDataType.MULTIPLE_LOOKUP_VALUES:
        return Type.Array(Type.String(), { description });

      case AirtableDataType.SINGLE_COLLABORATOR:
        return Type.Object(
          {
            id: Type.String(),
            email: Type.String({ format: 'email' }),
            name: Type.String(),
          },
          { description },
        );

      case AirtableDataType.MULTIPLE_COLLABORATORS:
        return Type.Array(
          Type.Object({
            id: Type.String(),
            email: Type.String({ format: 'email' }),
            name: Type.String(),
          }),
          { description },
        );

      case AirtableDataType.MULTIPLE_ATTACHMENTS:
        return Type.Array(
          Type.Object({
            id: Type.String(),
            url: Type.String({ format: 'uri' }),
            filename: Type.Optional(Type.String()),
            size: Type.Optional(Type.Number()),
            type: Type.Optional(Type.String()),
          }),
          { description },
        );

      case AirtableDataType.CREATED_BY:
      case AirtableDataType.LAST_MODIFIED_BY:
        return Type.Object(
          {
            id: Type.String(),
            email: Type.String({ format: 'email' }),
            name: Type.String(),
          },
          { description },
        );

      case AirtableDataType.FORMULA:
      case AirtableDataType.ROLLUP:
      case AirtableDataType.LOOKUP:
        // These can return various types, use unknown
        return Type.Unknown({ description });

      default:
        return Type.Unknown({ description });
    }
  }

  public downloadRecordDeep = undefined;

  async downloadRecordFiles(
    tableSpec: BaseJsonTableSpec,
    callback: (params: { files: ConnectorFile[]; connectorProgress?: JsonSafeObject }) => Promise<void>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _progress: JsonSafeObject,
  ): Promise<void> {
    const [baseId, tableId] = tableSpec.id.remoteId;

    for await (const rawRecords of this.client.listRecords(baseId, tableId)) {
      await callback({ files: rawRecords as unknown as ConnectorFile[] });
    }
  }

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
  // Handles both flat fields and Airtable's native `fields` wrapper format.
  private wsFieldsToAirtableFields(
    wsFields: Record<string, unknown>,
    tableSpec: AirtableTableSpec,
  ): Record<string, unknown> {
    const airtableFields: Record<string, unknown> = {};

    // Extract fields from `fields` wrapper if present (Airtable native JSON format)
    const fieldsData = (wsFields.fields as Record<string, unknown>) || {};

    for (const column of tableSpec.columns) {
      if (column.id.wsId === 'id' || !column.slug) {
        continue;
      }

      // Look for the field value in fieldsData first (by slug), then at the top level (by wsId)
      let val = column.slug ? fieldsData[column.slug] : undefined;
      if (val === undefined) {
        val = wsFields[column.id.wsId];
      }

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
