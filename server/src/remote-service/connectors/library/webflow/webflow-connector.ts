import { TObject, TSchema, Type } from '@sinclair/typebox';
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
  BaseJsonTableSpec,
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

  public pullRecordDeep = undefined;

  // eslint-disable-next-line @typescript-eslint/require-await
  async getNewFile(tableSpec: BaseJsonTableSpec): Promise<Record<string, unknown>> {
    const newFile: Record<string, unknown> = {
      cmsLocaleId: null,
      isArchived: false,
      isDraft: true,
      fieldData: {},
    };

    // Populate fieldData based on schema
    const schema = tableSpec.schema as TObject;
    const fieldDataSchema = schema.properties?.['fieldData'] as TObject | undefined;

    if (fieldDataSchema && fieldDataSchema.type === 'object' && fieldDataSchema.properties) {
      const fieldData: Record<string, unknown> = {};
      const properties = fieldDataSchema.properties as Record<string, TSchema>;

      for (const [key, propSchema] of Object.entries(properties)) {
        fieldData[key] = this.getDefaultValueForSchema(propSchema);
      }

      newFile.fieldData = fieldData;
    }

    return newFile;
  }

  private getDefaultValueForSchema(schema: TSchema): unknown {
    if (schema.default !== undefined) {
      return schema.default;
    }

    // Handle Optional wrapper (TypeBox Union of [Type, Null] or similar structure for Optional)
    // In TypeBox, Type.Optional(X) often creates a Modifier, but when compiled/inspected it might look specific.
    // However, our `webflowFieldToJsonSchema` mostly returns simple types or Type.Optional wrappers.
    // We'll approximate based on `type`.

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const type = schema.type;

    if (type === 'string') {
      if (schema.format === 'date-time') {
        return new Date().toISOString();
      }
      if (schema.format === 'uri') {
        return '';
      }
      return '';
    }

    if (type === 'number' || type === 'integer') {
      return 0;
    }

    if (type === 'boolean') {
      return false;
    }

    if (type === 'array') {
      return [];
    }

    if (type === 'object') {
      // For Image/File objects
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if ((schema as any).properties?.url) {
        return { url: '', alt: '' };
      }
      return {};
    }

    return null;
  }

  async pullRecordFiles(
    tableSpec: BaseJsonTableSpec,
    callback: (params: { files: ConnectorFile[]; connectorProgress?: JsonSafeObject }) => Promise<void>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _progress: JsonSafeObject,
  ): Promise<void> {
    WSLogger.info({ source: 'WebflowConnector', message: 'pullRecordFiles called', tableId: tableSpec.id.wsId });
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

      await callback({ files: items as unknown as ConnectorFile[] });

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

  /**
   * Validate files against the Webflow table schema.
   * Uses the shared file validator with Webflow-specific configuration.
   */
  validateFiles(tableSpec: WebflowTableSpec, files: FileValidationInput[]): Promise<FileValidationResult[]> {
    return Promise.resolve(validate(tableSpec, files));
  }

  /**
   * Fetch JSON Table Spec directly from the Webflow API for a collection.
   * Converts Webflow field types to JSON Schema types for AI consumption.
   * Uses field slugs as property keys.
   */
  async fetchJsonTableSpec(id: EntityId): Promise<BaseJsonTableSpec> {
    const [siteId, collectionId] = id.remoteId;

    // Fetch site and collection directly from Webflow API
    const [site, collection] = await Promise.all([
      this.client.sites.get(siteId),
      this.client.collections.get(collectionId),
    ]);

    const properties: Record<string, TSchema> = {};
    let titleColumnRemoteId: EntityId['remoteId'] | undefined;
    let mainContentColumnRemoteId: EntityId['remoteId'] | undefined;

    // Add item-level metadata fields (these are present in all Webflow items)
    properties['id'] = Type.String({ description: 'Unique item identifier (read-only)' });
    properties['cmsLocaleId'] = Type.Optional(Type.String({ description: 'CMS locale identifier (read-only)' }));
    properties['lastPublished'] = Type.Optional(
      Type.Union([Type.String({ format: 'date-time' }), Type.Null()], {
        description: 'When the item was last published (read-only)',
      }),
    );
    properties['lastUpdated'] = Type.Optional(
      Type.String({
        format: 'date-time',
        description: 'When the item was last updated (read-only)',
      }),
    );
    properties['createdOn'] = Type.Optional(
      Type.String({
        format: 'date-time',
        description: 'When the item was created (read-only)',
      }),
    );
    properties['isArchived'] = Type.Optional(
      Type.Boolean({ description: 'Whether the item is archived (default: false)' }),
    );
    properties['isDraft'] = Type.Optional(
      Type.Boolean({ description: 'Whether the item is a draft (default: false)' }),
    );

    // Add fieldData wrapper to indicate where custom fields are stored
    const fieldDataProperties: Record<string, TSchema> = {};

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
        fieldDataProperties[field.slug] = fieldSchema;
      } else {
        // Wrap optional fields in Type.Optional to exclude from required array
        fieldDataProperties[field.slug] = Type.Optional(fieldSchema);
      }

      // Track title column (name field)
      if (field.slug === 'name') {
        titleColumnRemoteId = [field.slug, field.id];
      }

      // Track main content column (first RichText field)
      if (!mainContentColumnRemoteId && field.type === Webflow.FieldType.RichText) {
        mainContentColumnRemoteId = [field.slug, field.id];
      }
    }

    // Add fieldData as an object containing all collection-specific fields
    properties['fieldData'] = Type.Object(fieldDataProperties, {
      description: 'Collection-specific field values',
    });

    const schema = Type.Object(properties, {
      $id: collectionId,
      title: `${site.displayName} - ${collection.displayName}`,
    });

    return {
      id,
      slug: collection.slug ?? id.wsId,
      name: `${site.displayName} - ${collection.displayName}`,
      schema,
      titleColumnRemoteId,
      mainContentColumnRemoteId,
      idColumnRemoteId: 'id',
      slugColumnRemoteId: 'fieldData.slug',
    };
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

  async pullTableRecords(
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

  /**
   * Create items in Webflow from raw JSON files.
   * Files should contain Webflow fieldData.
   * Returns the created items.
   */
  async createRecords(
    tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<ConnectorFile[]> {
    const [, collectionId] = tableSpec.id.remoteId;

    const fieldDataArray: Record<string, unknown>[] = [];
    for (const file of files) {
      const fields = await this.extractFieldDataForApi(file, tableSpec);
      fieldDataArray.push(fields);
    }

    const created = await this.client.collections.items.createItems(collectionId, {
      isArchived: false,
      isDraft: false,
      fieldData: fieldDataArray as Webflow.collections.CreateBulkCollectionItemRequestBodyFieldData,
    });

    const createdItems = _.get(created, 'items', []) as Webflow.CollectionItem[];
    return createdItems as unknown as ConnectorFile[];
  }

  /**
   * Update items in Webflow from raw JSON files.
   * Files should have an 'id' field and fieldData to update.
   */
  async updateRecords(
    tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<void> {
    const [, collectionId] = tableSpec.id.remoteId;

    const items: { id: string; fieldData: Webflow.CollectionItemFieldData }[] = [];
    for (const file of files) {
      const fieldData = await this.extractFieldDataForApi(file, tableSpec);
      items.push({
        id: file.id as string,
        fieldData: fieldData as Webflow.CollectionItemFieldData,
      });
    }

    await this.client.collections.items.updateItems(collectionId, { items });
  }

  /**
   * Delete items from Webflow.
   * Files should have an 'id' field with the item ID to delete.
   * Returns successfully if items are already deleted (404).
   */
  async deleteRecords(tableSpec: BaseJsonTableSpec, files: ConnectorFile[]): Promise<void> {
    const [, collectionId] = tableSpec.id.remoteId;

    const items = files.map((file) => ({ id: file.id as string }));
    try {
      await this.client.collections.items.deleteItems(collectionId, { items });
    } catch (e) {
      // If item not found (404), that's fine - it's already deleted
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.includes('404') || errorMessage.includes('not_found') || errorMessage.includes('not found')) {
        // Item already deleted on remote, return success
        return;
      }
      throw e;
    }
  }

  /**
   * Extracts and processes fieldData for sending to Webflow API.
   * Extracts fieldData from the file and minifies RichText fields.
   */
  private async extractFieldDataForApi(
    file: ConnectorFile,
    tableSpec: BaseJsonTableSpec,
  ): Promise<Record<string, unknown>> {
    // Extract fieldData wrapper - this is the Webflow native JSON format
    const fieldData = (file.fieldData as Record<string, unknown>) || {};
    return this.processFieldDataWithSchema(fieldData, tableSpec);
  }

  /**
   * Process fieldData using JSON schema to identify and minify RichText fields.
   * RichText fields are identified by contentMediaType: 'text/html' in the schema.
   * Only fields that exist in the schema are included - unknown fields are filtered out.
   */
  private async processFieldDataWithSchema(
    fieldData: Record<string, unknown>,
    tableSpec: BaseJsonTableSpec,
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    // Get the fieldData schema properties
    const schema = tableSpec.schema as TObject;
    const fieldDataSchema = schema.properties?.['fieldData'] as TObject | undefined;
    const fieldProperties = fieldDataSchema?.properties as Record<string, TSchema> | undefined;

    for (const [key, value] of Object.entries(fieldData)) {
      if (value === undefined) {
        continue;
      }

      // Only include fields that are defined in the schema
      const fieldSchema = fieldProperties?.[key];
      if (!fieldSchema) {
        // Skip unknown fields - they would cause Webflow API validation errors
        continue;
      }

      // Check if this field is a RichText field (has contentMediaType: 'text/html')
      const isRichText = (fieldSchema as { contentMediaType?: string }).contentMediaType === 'text/html';

      if (isRichText && typeof value === 'string') {
        result[key] = await minifyHtml(value);
      } else {
        result[key] = value;
      }
    }

    return result;
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
