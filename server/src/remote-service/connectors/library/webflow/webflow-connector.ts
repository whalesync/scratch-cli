import { TSchema, Type } from '@sinclair/typebox';
import { Service } from '@spinner/shared-types';
import _ from 'lodash';
import { WSLogger } from 'src/logger';
import { JsonSafeObject, JsonSafeValue } from 'src/utils/objects';
import type { SnapshotColumnSettingsMap } from 'src/workbook/types';
import { Webflow, WebflowClient, WebflowError } from 'webflow-api';
import { minifyHtml } from '../../../../wrappers/html-minify';
import { Connector } from '../../connector';
import { validate } from '../../file-validator';
import {
  ConnectorErrorDetails,
  ConnectorFile,
  ConnectorRecord,
  EntityId,
  FileValidationInput,
  FileValidationResult,
  TablePreview,
} from '../../types';
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

  async downloadRecordFiles(
    tableSpec: WebflowTableSpec,
    callback: (params: { files: ConnectorFile[]; connectorProgress?: JsonSafeObject }) => Promise<void>,
    progress: JsonSafeObject,
  ): Promise<void> {
    WSLogger.info({ source: 'WebflowConnector', message: 'downloadRecordFiles called', tableId: tableSpec.id.wsId });
    await callback({ files: [], connectorProgress: progress });
  }

  /**
   * Validate files against the Webflow table schema.
   * Uses the shared file validator with Webflow-specific configuration.
   */
  validateFiles(tableSpec: WebflowTableSpec, files: FileValidationInput[]): Promise<FileValidationResult[]> {
    return Promise.resolve(validate(tableSpec, files));
  }

  /**
   * Fetch JSON Schema directly from the Webflow API for a collection.
   * Converts Webflow field types to JSON Schema types for AI consumption.
   * Uses field slugs as property keys.
   */
  async fetchJsonTableSpec(id: EntityId): Promise<TSchema> {
    const [siteId, collectionId] = id.remoteId;

    // Fetch site and collection directly from Webflow API
    const [site, collection] = await Promise.all([
      this.client.sites.get(siteId),
      this.client.collections.get(collectionId),
    ]);

    const properties: Record<string, TSchema> = {};
    const requiredFields: string[] = [];

    for (const field of collection.fields) {
      // Skip fields without a slug
      if (!field.slug) {
        continue;
      }

      const fieldSchema = this.webflowFieldToJsonSchema(field);

      // Check if field is required using Webflow's isRequired property
      // slug and name fields are always required for Webflow
      const isRequired = field.isRequired || field.slug === 'slug' || field.slug === 'name';

      if (isRequired) {
        properties[field.slug] = fieldSchema;
        requiredFields.push(field.slug);
      } else {
        // Wrap optional fields in Type.Optional to exclude from required array
        properties[field.slug] = Type.Optional(fieldSchema);
      }
    }

    return Type.Object(properties, {
      $id: collectionId,
      title: `${site.displayName} - ${collection.displayName}`,
    });
  }

  /**
   * Convert a Webflow field directly to a TypeBox JSON Schema.
   */
  private webflowFieldToJsonSchema(field: Webflow.Field): TSchema {
    const description = field.displayName;

    switch (field.type) {
      case Webflow.FieldType.PlainText:
      case Webflow.FieldType.Reference:
        return Type.String({ description });

      case Webflow.FieldType.RichText:
        return Type.String({ description, contentMediaType: 'text/html' });

      case Webflow.FieldType.Number: {
        const validations = field.validations as { format?: 'decimal' | 'integer' } | undefined;
        if (validations?.format === 'integer') {
          return Type.Integer({ description });
        }
        return Type.Number({ description });
      }

      case Webflow.FieldType.Switch:
        return Type.Boolean({ description });

      case Webflow.FieldType.DateTime:
        return Type.String({ description, format: 'date-time' });

      case Webflow.FieldType.Email:
        return Type.String({ description, format: 'email' });

      case Webflow.FieldType.Phone:
        return Type.String({ description });

      case Webflow.FieldType.Link:
      case Webflow.FieldType.VideoLink:
        return Type.String({ description, format: 'uri' });

      case Webflow.FieldType.Color:
        return Type.String({ description });

      case Webflow.FieldType.Option: {
        // Webflow options are in validations.options as array of { id, name }
        const options = _.get(field.validations, 'options', []) as { id: string; name: string }[];
        if (options.length > 0) {
          return Type.Union(
            options.map((opt) => Type.Literal(opt.id, { title: opt.name })),
            { description },
          );
        }
        return Type.String({ description });
      }

      case Webflow.FieldType.Image:
      case Webflow.FieldType.File:
        return Type.Object(
          {
            url: Type.String({ format: 'uri' }),
            alt: Type.Optional(Type.String()),
          },
          { description },
        );

      case Webflow.FieldType.MultiImage:
        return Type.Array(
          Type.Object({
            url: Type.String({ format: 'uri' }),
            alt: Type.Optional(Type.String()),
          }),
          { description },
        );

      case Webflow.FieldType.MultiReference:
        return Type.Array(Type.String(), { description });

      default:
        // Default to unknown for unrecognized types
        return Type.Unknown({ description });
    }
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
