import { Service } from '@spinner/shared-types';
import _ from 'lodash';
import { JsonSafeObject, JsonSafeValue } from 'src/utils/objects';
import type { SnapshotColumnSettingsMap } from 'src/workbook/types';
import { Webflow, WebflowClient, WebflowError } from 'webflow-api';
import { minifyHtml } from '../../../../wrappers/html-minify';
import { Connector } from '../../connector';
import { ConnectorErrorDetails, ConnectorRecord, EntityId, PostgresColumnType, TablePreview } from '../../types';
import { WebflowTableSpec } from '../custom-spec-registry';
import { WebflowSchemaParser } from './webflow-schema-parser';
import {
  WEBFLOW_ECOMMERCE_COLLECTION_SLUGS,
  WEBFLOW_METADATA_COLUMNS,
  WebflowItemMetadata,
} from './webflow-spec-types';

export const WEBFLOW_DEFAULT_BATCH_SIZE = 100;

export class WebflowConnector extends Connector<typeof Service.WEBFLOW> {
  readonly service = Service.WEBFLOW;
  static readonly displayName = 'Webflow';

  private readonly client: WebflowClient;
  private readonly schemaParser = new WebflowSchemaParser();

  constructor(accessToken: string) {
    super();
    this.client = new WebflowClient({ accessToken });
  }

  public async testConnection(): Promise<void> {
    // Test connection by listing sites
    await this.client.sites.list();
  }

  async listTables(): Promise<TablePreview[]> {
    const tables: TablePreview[] = [];

    // Get all sites
    const sitesResponse = await this.client.sites.list();
    const sites = sitesResponse.sites || [];

    // For each site, get all collections
    for (const site of sites) {
      const collectionsResponse = await this.client.collections.list(site.id);
      const collections = collectionsResponse.collections || [];

      for (const collection of collections) {
        // Skip ecommerce collections (Products, Categories, SKUs)
        if (collection.slug && WEBFLOW_ECOMMERCE_COLLECTION_SLUGS.includes(collection.slug)) {
          continue;
        }
        tables.push(this.schemaParser.parseTablePreview(site, collection));
      }
    }

    return tables;
  }

  async fetchTableSpec(id: EntityId): Promise<WebflowTableSpec> {
    const [siteId, collectionId] = id.remoteId;

    // Get site details
    const site = await this.client.sites.get(siteId);

    // Get collection details (which includes the schema)
    const collection = await this.client.collections.get(collectionId);

    return this.schemaParser.parseTableSpec(site, collection);
  }

  public downloadRecordDeep = undefined;

  /**
   * Validate files against the Webflow table schema.
   * Checks for:
   * - Missing required fields
   * - Unknown fields not in schema
   * - Data type validation (boolean, number, email, url, etc.)
   */
  async validateFiles(
    tableSpec: WebflowTableSpec,
    files: { filename: string; id?: string; data: Record<string, unknown> }[],
  ): Promise<
    { filename: string; id?: string; data: Record<string, unknown>; publishable: boolean; errors?: string[] }[]
  > {
    // Build a map of field names to column specs for easy lookup
    const columnMap = new Map<string, (typeof tableSpec.columns)[0]>();
    const requiredFields: string[] = [];

    for (const column of tableSpec.columns) {
      columnMap.set(column.id.wsId, column);
      if (column.required && !column.readonly) {
        requiredFields.push(column.id.wsId);
      }
    }

    // Fields that are metadata/internal and should be ignored during validation
    const ignoredFields = new Set(['remoteId', '_content']);

    const results = files.map((file) => {
      const errors: string[] = [];

      // Check for missing required fields
      for (const requiredField of requiredFields) {
        const value = file.data[requiredField];
        if (value === undefined || value === null || value === '') {
          const column = columnMap.get(requiredField);
          const fieldName = column?.name || requiredField;
          errors.push(`Missing required field: "${fieldName}"`);
        }
      }

      // Check for unknown fields and validate data types
      for (const [fieldKey, value] of Object.entries(file.data)) {
        if (ignoredFields.has(fieldKey)) {
          continue;
        }

        const column = columnMap.get(fieldKey);

        // Check for unknown fields
        if (!column) {
          errors.push(`Unknown field not in schema: "${fieldKey}"`);
          continue;
        }

        // Skip type validation for null/undefined values (handled by required check)
        if (value === undefined || value === null || value === '') {
          continue;
        }

        // Validate data types based on pgType and metadata
        const typeError = this.validateFieldType(fieldKey, value, column);
        if (typeError) {
          errors.push(typeError);
        }
      }

      return {
        filename: file.filename,
        id: file.id,
        data: file.data,
        publishable: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    });

    return Promise.resolve(results);
  }

  /**
   * Validates a field value against its expected type.
   * Returns an error message if validation fails, or undefined if valid.
   */
  private validateFieldType(
    fieldKey: string,
    value: unknown,
    column: WebflowTableSpec['columns'][0],
  ): string | undefined {
    const fieldName = column.name || fieldKey;
    const pgType = column.pgType;
    const metadata = column.metadata;

    switch (pgType) {
      case PostgresColumnType.BOOLEAN: {
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          return `Invalid type for "${fieldName}": expected boolean, got ${typeof value}`;
        }
        break;
      }

      case PostgresColumnType.NUMERIC: {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (typeof numValue !== 'number' || isNaN(numValue)) {
          return `Invalid type for "${fieldName}": expected number, got ${typeof value}`;
        }
        // Check integer format if specified
        if (metadata?.numberFormat === 'integer' && !Number.isInteger(numValue)) {
          return `Invalid type for "${fieldName}": expected integer, got decimal`;
        }
        break;
      }

      case PostgresColumnType.TIMESTAMP: {
        // Accept strings that can be parsed as dates
        if (typeof value === 'string') {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return `Invalid type for "${fieldName}": expected valid date string, got "${value}"`;
          }
        } else if (!(value instanceof Date)) {
          return `Invalid type for "${fieldName}": expected date, got ${typeof value}`;
        }
        break;
      }

      case PostgresColumnType.TEXT: {
        // For text fields, check special formats in metadata
        if (typeof value !== 'string') {
          return `Invalid type for "${fieldName}": expected string, got ${typeof value}`;
        }

        // Validate email format
        if (metadata?.textFormat === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return `Invalid format for "${fieldName}": expected valid email address`;
          }
        }

        // Validate URL format
        if (metadata?.textFormat === 'url') {
          try {
            new URL(value);
          } catch {
            return `Invalid format for "${fieldName}": expected valid URL`;
          }
        }

        // Validate option fields (if options are defined)
        if (metadata?.options && metadata.options.length > 0 && !metadata.allowAnyOption) {
          const validValues = metadata.options.map((opt) => opt.value);
          if (!validValues.includes(value)) {
            const validLabels = metadata.options.map((opt) => opt.label || opt.value).join(', ');
            return `Invalid value for "${fieldName}": must be one of: ${validLabels}`;
          }
        }
        break;
      }

      case PostgresColumnType.JSONB: {
        // JSONB can be objects or arrays - just check it's not a primitive that should be something else
        if (typeof value !== 'object' && !Array.isArray(value)) {
          // Allow strings that might be JSON
          if (typeof value === 'string') {
            try {
              JSON.parse(value);
            } catch {
              return `Invalid type for "${fieldName}": expected JSON object or array`;
            }
          }
        }
        break;
      }
    }

    return undefined;
  }

  async downloadTableRecords(
    tableSpec: WebflowTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    callback: (params: { records: ConnectorRecord[]; connectorProgress?: JsonSafeObject }) => Promise<void>,
  ): Promise<void> {
    const [, collectionId] = tableSpec.id.remoteId;

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // List items with pagination
      const response = await this.client.collections.items.listItems(collectionId, {
        offset,
        limit: WEBFLOW_DEFAULT_BATCH_SIZE,
      });

      const items = response.items || [];

      if (items.length === 0) {
        hasMore = false;
        break;
      }

      const records = this.wireToConnectorRecord(items, tableSpec);
      await callback({ records });

      // Check if there are more items
      const pagination = response.pagination;
      if (pagination) {
        const total = pagination.total || 0;
        offset += items.length;
        hasMore = offset < total;
      } else {
        // If no pagination info, assume we're done if we got less than limit
        hasMore = items.length === WEBFLOW_DEFAULT_BATCH_SIZE;
        offset += items.length;
      }
    }
  }

  // Record fields need to be keyed by the wsId, not the remoteId.
  private wireToConnectorRecord(items: Webflow.CollectionItem[], tableSpec: WebflowTableSpec): ConnectorRecord[] {
    return items.map((item) => {
      const { id, fieldData, ...metadata } = item;
      const record: ConnectorRecord = {
        id: id || '',
        fields: {},
        metadata,
      };

      for (const column of tableSpec.columns) {
        const fieldId = column.id.wsId;

        // Handle predefined metadata columns
        if (WEBFLOW_METADATA_COLUMNS.includes(fieldId as keyof WebflowItemMetadata)) {
          record.fields[fieldId] = metadata[fieldId as keyof WebflowItemMetadata];
        }

        // Webflow uses a slug for the column value, this is really bad, but if we don't have a slug
        // we can't get the value of the record column.
        // they are supposed to be unique and once set, they will not change.
        if (!column.slug) {
          continue;
        }

        const fieldValue = _.get(fieldData, column.slug) as JsonSafeValue;

        if (fieldValue !== undefined) {
          record.fields[fieldId] = fieldValue;
        }
      }

      return record;
    });
  }

  getBatchSize(): number {
    // Webflow supports bulk operations up to 100 items
    return WEBFLOW_DEFAULT_BATCH_SIZE;
  }

  async createRecords(
    tableSpec: WebflowTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    records: { wsId: string; fields: Record<string, unknown> }[],
  ): Promise<{ wsId: string; remoteId: string }[]> {
    const [, collectionId] = tableSpec.id.remoteId;

    const fieldData: Webflow.collections.CreateBulkCollectionItemRequestBodyFieldData[] = [];
    for (const record of records) {
      const fields = await this.wsFieldsToWebflowFields(record.fields, tableSpec);
      fieldData.push({
        ...fields,
      } as Webflow.collections.CreateBulkCollectionItemRequestBodyFieldData);
    }

    const created = await this.client.collections.items.createItems(collectionId, {
      isArchived: false,
      isDraft: false,
      fieldData: fieldData as Webflow.collections.CreateBulkCollectionItemRequestBodyFieldData,
    });

    const results = _.get(created, 'items', []).map((item: Webflow.CollectionItem, index: number) => ({
      wsId: records[index].wsId,
      remoteId: item.id || '',
    }));

    return results;
  }

  async updateRecords(
    tableSpec: WebflowTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    records: {
      id: { wsId: string; remoteId: string };
      partialFields: Record<string, unknown>;
    }[],
  ): Promise<void> {
    const [, collectionId] = tableSpec.id.remoteId;

    const items: { id: string; fieldData: Webflow.CollectionItemFieldData }[] = [];
    for (const record of records) {
      const fieldData = await this.wsFieldsToWebflowFields(record.partialFields, tableSpec);
      items.push({
        id: record.id.remoteId,
        fieldData: fieldData as Webflow.CollectionItemFieldData,
      });
    }

    await this.client.collections.items.updateItems(collectionId, { items });
  }

  async deleteRecords(tableSpec: WebflowTableSpec, recordIds: { wsId: string; remoteId: string }[]): Promise<void> {
    const [, collectionId] = tableSpec.id.remoteId;

    const items = recordIds.map((recordId) => ({ id: recordId.remoteId }));
    await this.client.collections.items.deleteItems(collectionId, { items });
  }

  // Record fields need to be keyed by the remoteId, not the wsId.
  private async wsFieldsToWebflowFields(
    wsFields: Record<string, unknown>,
    tableSpec: WebflowTableSpec,
  ): Promise<Record<string, unknown>> {
    const webflowFields: Record<string, unknown> = {};

    for (const column of tableSpec.columns) {
      // We don't need to set the metadata columns as they are read only.
      // we shouldn't get to this point but just in case for safety.
      // (Question: how does this if check make sense?)
      if (WEBFLOW_METADATA_COLUMNS.includes(column.id.wsId as keyof WebflowItemMetadata)) {
        continue;
      }

      const wsValue = wsFields[column.id.wsId];
      if (wsValue !== undefined && column.slug) {
        if (column.webflowFieldType === Webflow.FieldType.RichText) {
          const html: string = wsValue as string;
          webflowFields[column.slug] = await minifyHtml(html);
        } else {
          webflowFields[column.slug] = wsValue;
        }
      }
    }

    return webflowFields;
  }

  extractConnectorErrorDetails(error: unknown): ConnectorErrorDetails {
    // TODO: Webflow errors are really bad for user friendliness, we should improve this.
    const errors = _.get(error, 'errors');
    if (errors && Array.isArray(errors)) {
      const formattedError = {
        userFriendlyMessage: (errors as { message: string }[]).map((error) => error.message).join('; '),
        description: (errors as { message: string }[]).map((error) => error.message).join('; '),
      };
      return formattedError;
    }
    if (error instanceof WebflowError) {
      if (
        error.statusCode === 409 &&
        error.message.includes("You've created all the items in your CMS Database allowed on your current plan.")
      ) {
        return {
          userFriendlyMessage: 'You have reached the maximum number of CMS items allowed for your plan.',
        };
      }
      return {
        userFriendlyMessage: error.message,
        description: error.message,
      };
    }
    return {
      userFriendlyMessage: 'An error occurred while connecting to Webflow',
      description: error instanceof Error ? error.message : String(error),
    };
  }
}
