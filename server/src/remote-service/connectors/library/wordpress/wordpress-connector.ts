import { Type, type TSchema } from '@sinclair/typebox';
import { Service } from '@spinner/shared-types';
import { isAxiosError } from 'axios';
import type { SnapshotColumnSettingsMap } from 'src/workbook/types';
import TurndownService from 'turndown';
import { Connector } from '../../connector';
import { extractErrorMessageFromAxiosError } from '../../error';
import { validate } from '../../file-validator';
import { sanitizeForTableWsId } from '../../ids';
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
import { WordPressTableSpec } from '../custom-spec-registry';
import {
  WORDPRESS_CREATE_UNSUPPORTED_TABLE_IDS,
  WORDPRESS_DEFAULT_TABLE_IDS,
  WORDPRESS_POLLING_PAGE_SIZE,
  WORDPRESS_REMOTE_CUSTOM_FIELDS_ID,
} from './wordpress-constants';
import { WordPressHttpClient } from './wordpress-http-client';
import { parseTableInfoFromTypes, WORDPRESS_RICH_TEXT_TARGET } from './wordpress-schema-parser';
import { WordPressArgument, WordPressDataType, WordPressDownloadProgress, WordPressRecord } from './wordpress-types';

export class WordPressConnector extends Connector<typeof Service.WORDPRESS, WordPressDownloadProgress> {
  readonly service = Service.WORDPRESS;
  static readonly displayName = 'WordPress';

  private client: WordPressHttpClient;
  private readonly turndownService: TurndownService = new TurndownService({
    headingStyle: 'atx',
  });

  constructor(username: string, password: string, endpoint: string) {
    super();
    this.client = new WordPressHttpClient(endpoint, username, password);
  }

  async testConnection(): Promise<void> {
    await this.client.testEndpoint();
  }

  async listTables(): Promise<TablePreview[]> {
    // Get post types from WordPress
    const typesResponse = await this.client.getTypes();
    const tables = parseTableInfoFromTypes(typesResponse);

    // Add default tables (tags, categories)
    const defaultTables = WORDPRESS_DEFAULT_TABLE_IDS.map((tableId) => ({
      id: {
        wsId: sanitizeForTableWsId(tableId),
        remoteId: [tableId],
      },
      displayName: formatTableName(tableId),
    }));

    return [...tables, ...defaultTables];
  }

  /**
   * Fetch JSON Table Spec directly from the WordPress API for a post type/endpoint.
   * Returns a schema that describes the raw WordPress record format with rendered objects.
   */
  async fetchJsonTableSpec(id: EntityId): Promise<BaseJsonTableSpec> {
    const [tableId] = id.remoteId;
    const optionsResponse = await this.client.getEndpointOptions(tableId);

    const properties: Record<string, TSchema> = {};
    let titleColumnRemoteId: EntityId['remoteId'] | undefined;
    let mainContentColumnRemoteId: EntityId['remoteId'] | undefined;

    // Get schema properties from the endpoint OPTIONS response
    const schemaProps = optionsResponse.schema?.properties || {};

    for (const [fieldId, fieldDef] of Object.entries(schemaProps)) {
      if (!fieldDef || !('type' in fieldDef)) continue;

      const fieldSchema = this.wordpressFieldToJsonSchema(fieldId, fieldDef);

      // Check if field is required
      if (fieldDef.required) {
        properties[fieldId] = fieldSchema;
      } else {
        properties[fieldId] = Type.Optional(fieldSchema);
      }

      // Track title column
      if (fieldId === 'title') {
        titleColumnRemoteId = [tableId, fieldId];
      }

      // Track main content column
      if (fieldId === 'content' && !mainContentColumnRemoteId) {
        mainContentColumnRemoteId = [tableId, fieldId];
      }
    }

    // Handle ACF (Advanced Custom Fields) if present
    const acfProps = schemaProps.acf?.properties;
    if (acfProps) {
      const acfFieldProperties: Record<string, TSchema> = {};
      for (const [acfFieldId, acfFieldDef] of Object.entries(acfProps)) {
        if (!acfFieldDef) continue;
        acfFieldProperties[acfFieldId] = Type.Optional(this.wordpressFieldToJsonSchema(acfFieldId, acfFieldDef));
      }
      properties['acf'] = Type.Optional(Type.Object(acfFieldProperties, { description: 'Advanced Custom Fields' }));
    }

    const schema = Type.Object(properties, {
      $id: tableId,
      title: formatTableName(tableId),
    });

    return {
      id,
      slug: id.wsId,
      name: formatTableName(tableId),
      schema,
      idColumnRemoteId: 'id',
      titleColumnRemoteId,
      mainContentColumnRemoteId,
      slugColumnRemoteId: 'slug',
    };
  }

  /**
   * Convert a WordPress field argument to a TypeBox JSON Schema.
   */
  private wordpressFieldToJsonSchema(fieldId: string, field: WordPressArgument): TSchema {
    const description = fieldId;
    const fieldType = Array.isArray(field.type) ? field.type[0] : field.type;

    // Handle rendered objects (title, content, excerpt, etc.)
    if (field.properties?.rendered) {
      return Type.Object(
        {
          rendered: Type.String({ description: 'HTML rendered content' }),
          raw: Type.Optional(Type.String({ description: 'Raw content' })),
          protected: Type.Optional(Type.Boolean()),
        },
        { description },
      );
    }

    // Handle enums
    if (field.enum && field.enum.length > 0) {
      return Type.Union(
        field.enum.map((val) => Type.Literal(val)),
        { description },
      );
    }

    switch (fieldType) {
      case 'integer':
        return Type.Integer({ description });

      case 'number':
        return Type.Number({ description });

      case 'boolean':
        return Type.Boolean({ description });

      case 'string':
        if (field.format === 'date-time') {
          return Type.String({ description, format: 'date-time' });
        }
        if (field.format === 'uri') {
          return Type.String({ description, format: 'uri' });
        }
        if (field.format === 'email') {
          return Type.String({ description, format: 'email' });
        }
        return Type.String({ description });

      case 'array':
        return Type.Array(Type.Unknown(), { description });

      case 'object':
        if (field.properties) {
          const objProps: Record<string, TSchema> = {};
          for (const [propId, propDef] of Object.entries(field.properties)) {
            if (propDef) {
              objProps[propId] = this.wordpressFieldToJsonSchema(propId, propDef);
            }
          }
          return Type.Object(objProps, { description });
        }
        return Type.Record(Type.String(), Type.Unknown(), { description });

      default:
        return Type.Unknown({ description });
    }
  }

  async pullTableRecords(
    tableSpec: WordPressTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
    callback: (params: { records: ConnectorRecord[]; connectorProgress?: WordPressDownloadProgress }) => Promise<void>,
    progress?: WordPressDownloadProgress,
  ): Promise<void> {
    const [tableId] = tableSpec.id.remoteId;
    let offset = progress?.nextOffset ?? 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.pollRecords(tableId, offset, WORDPRESS_POLLING_PAGE_SIZE);

      if (!Array.isArray(response)) {
        throw new Error(`Unexpected response format from WordPress: expected array, got ${typeof response}`);
      }

      const records = response.map((wpRecord) =>
        this.wordPressRecordToConnectorRecord(wpRecord, tableSpec, columnSettingsMap),
      );

      const returnedCount = records.length;
      if (returnedCount < WORDPRESS_POLLING_PAGE_SIZE) {
        hasMore = false;
        await callback({ records, connectorProgress: { nextOffset: undefined } });
      } else {
        offset += returnedCount;
        await callback({ records, connectorProgress: { nextOffset: offset } });
      }
    }
  }

  public pullRecordDeep = undefined;

  async pullRecordFiles(
    tableSpec: BaseJsonTableSpec,
    callback: (params: { files: ConnectorFile[]; connectorProgress?: WordPressDownloadProgress }) => Promise<void>,
    progress?: WordPressDownloadProgress,
  ): Promise<void> {
    const [tableId] = tableSpec.id.remoteId;
    let offset = progress?.nextOffset ?? 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.pollRecords(tableId, offset, WORDPRESS_POLLING_PAGE_SIZE);

      if (!Array.isArray(response)) {
        throw new Error(`Unexpected response format from WordPress: expected array, got ${typeof response}`);
      }

      const returnedCount = response.length;
      if (returnedCount < WORDPRESS_POLLING_PAGE_SIZE) {
        hasMore = false;
        await callback({ files: response as unknown as ConnectorFile[], connectorProgress: { nextOffset: undefined } });
      } else {
        offset += returnedCount;
        await callback({ files: response as unknown as ConnectorFile[], connectorProgress: { nextOffset: offset } });
      }
    }
  }

  /**
   * Convert raw WordPress records to ConnectorFiles with minimal transformation.
   * Preserves native API structure: rendered objects, ACF fields nested under 'acf', etc.
   */
  private wireToConnectorFiles(wpRecords: WordPressRecord[]): ConnectorFile[] {
    return wpRecords.map((wpRecord) => {
      const { id, ...data } = wpRecord;
      return {
        id: String(id ?? ''),
        data: data as Record<string, unknown>,
      };
    });
  }

  /**
   * Validate files against the WordPress table schema.
   * Uses the shared file validator - WordPress stores dates as TEXT with dateFormat metadata,
   * which the shared validator handles automatically.
   */
  validateFiles(tableSpec: WordPressTableSpec, files: FileValidationInput[]): Promise<FileValidationResult[]> {
    return Promise.resolve(validate(tableSpec, files));
  }

  getBatchSize(): number {
    return 1;
  }

  /**
   * Create records in WordPress from raw JSON files.
   * Files should contain the fields to create (title, content, etc.).
   * Returns the created records with their new IDs.
   */
  async createRecords(
    tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<ConnectorFile[]> {
    const [tableId] = tableSpec.id.remoteId;

    // Check if this table supports create
    if (WORDPRESS_CREATE_UNSUPPORTED_TABLE_IDS.includes(tableId)) {
      throw new Error(`Table "${tableId}" does not support record creation`);
    }

    const results: ConnectorFile[] = [];

    for (const file of files) {
      // WordPress expects fields directly at the top level
      const wpRecord = this.fileToWordPressRecord(file);
      const created = await this.client.createRecord(tableId, wpRecord);
      results.push(created as unknown as ConnectorFile);
    }

    return results;
  }

  /**
   * Update records in WordPress from raw JSON files.
   * Files should have an 'id' field and the fields to update.
   */
  async updateRecords(
    tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<void> {
    const [tableId] = tableSpec.id.remoteId;

    for (const file of files) {
      const recordId = String(file.id);
      const wpRecord = this.fileToWordPressRecord(file);
      await this.client.updateRecord(tableId, recordId, wpRecord);
    }
  }

  /**
   * Delete records from WordPress.
   * Files should have an 'id' field with the record ID to delete.
   */
  async deleteRecords(tableSpec: BaseJsonTableSpec, files: ConnectorFile[]): Promise<void> {
    const [tableId] = tableSpec.id.remoteId;

    for (const file of files) {
      const recordId = String(file.id);
      await this.client.deleteRecord(tableId, recordId);
    }
  }

  /**
   * Convert a ConnectorFile to a WordPress record for API calls.
   * Extracts writable fields and handles rendered content objects.
   */
  private fileToWordPressRecord(file: ConnectorFile): WordPressRecord {
    const wpRecord: WordPressRecord = {};

    for (const [key, value] of Object.entries(file)) {
      // Skip id and metadata fields
      if (key === 'id' || key === 'createdTime') {
        continue;
      }

      // Handle rendered objects - WordPress expects just the value, not the rendered wrapper
      if (value && typeof value === 'object' && 'rendered' in value) {
        wpRecord[key] = (value as { rendered: unknown }).rendered;
      } else {
        wpRecord[key] = value;
      }
    }

    return wpRecord;
  }

  /**
   * Convert a WordPress record to a ConnectorRecord
   */
  private wordPressRecordToConnectorRecord(
    wpRecord: WordPressRecord,
    tableSpec: WordPressTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
  ): ConnectorRecord {
    const record: ConnectorRecord = {
      id: String(wpRecord.id),
      fields: {},
    };

    const fieldIds = Object.keys(wpRecord);
    for (const fieldId of fieldIds) {
      // Handle ACF (Advanced Custom Fields)
      if (fieldId === WORDPRESS_REMOTE_CUSTOM_FIELDS_ID) {
        const acfObject = wpRecord[WORDPRESS_REMOTE_CUSTOM_FIELDS_ID] as Record<string, unknown>;
        if (acfObject && typeof acfObject === 'object') {
          for (const [acfFieldId, value] of Object.entries(acfObject)) {
            const column = tableSpec.columns.find((c) => c.id.remoteId[0] === acfFieldId);
            let convertedValue = value;
            if (!column || value === undefined) {
              continue;
            }
            // Handle values being returned as empty string by ACF
            if (
              column.wordpressDataType === WordPressDataType.NUMBER ||
              column.wordpressDataType === WordPressDataType.INTEGER ||
              column.wordpressDataType === WordPressDataType.ARRAY ||
              column.wordpressDataType === WordPressDataType.BOOLEAN
            ) {
              if (value === '') {
                convertedValue = null;
              }
            }
            record.fields[column.id.wsId] = convertedValue;
          }
        }
        continue;
      }

      // Handle regular fields
      const column = tableSpec.columns.find((c) => c.id.remoteId[0] === fieldId);
      if (column) {
        const value = wpRecord[fieldId];
        if (value !== undefined) {
          // Handle rendered objects (content, title, etc)
          if (value && typeof value === 'object' && 'rendered' in value) {
            const dataConverter = columnSettingsMap[column.id.wsId]?.dataConverter;
            const rendered = (value as { rendered: string }).rendered;
            switch (dataConverter) {
              case WORDPRESS_RICH_TEXT_TARGET.MARKDOWN:
                record.fields[column.id.wsId] = String(this.turndownService.turndown(rendered));
                break;
              case WORDPRESS_RICH_TEXT_TARGET.HTML:
              default:
                record.fields[column.id.wsId] = rendered;
                break;
            }
          } else {
            record.fields[column.id.wsId] = value;
          }
        }
      }
    }

    return record;
  }

  extractConnectorErrorDetails(error: unknown): ConnectorErrorDetails {
    if (isAxiosError(error)) {
      const message = extractErrorMessageFromAxiosError(this.service, error, ['message']);
      return {
        userFriendlyMessage: `Wordpress returned an error: ${message}`,
        description: `Wordpress returned HTTP ${error.status}: ${message}`,
      };
    }

    return {
      userFriendlyMessage: `An error occurred while connecting to Wordpress: ${error instanceof Error ? error.message : 'Unknown error'}`,
      description: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Format a table name for display
 */
function formatTableName(tableId: string): string {
  return tableId
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
