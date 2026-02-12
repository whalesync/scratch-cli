import { Service } from '@spinner/shared-types';
import { isAxiosError } from 'axios';
import TurndownService from 'turndown';
import { Connector } from '../../connector';
import { extractErrorMessageFromAxiosError } from '../../error';
import { sanitizeForTableWsId } from '../../ids';
import { BaseJsonTableSpec, ConnectorErrorDetails, ConnectorFile, EntityId, TablePreview } from '../../types';
import {
  WORDPRESS_CREATE_UNSUPPORTED_TABLE_IDS,
  WORDPRESS_DEFAULT_TABLE_IDS,
  WORDPRESS_POLLING_PAGE_SIZE,
} from './wordpress-constants';
import { WordPressHttpClient } from './wordpress-http-client';
import { buildWordPressJsonTableSpec, formatTableName } from './wordpress-json-schema';
import { parseTableInfoFromTypes } from './wordpress-schema-parser';
import { WordPressDownloadProgress, WordPressRecord } from './wordpress-types';

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

    return buildWordPressJsonTableSpec(id, optionsResponse);
  }

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

  getBatchSize(): number {
    return 1;
  }

  /**
   * Create records in WordPress from raw JSON files.
   * Files should contain the fields to create (title, content, etc.).
   * Returns the created records with their new IDs.
   */
  async createRecords(tableSpec: BaseJsonTableSpec, files: ConnectorFile[]): Promise<ConnectorFile[]> {
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
  async updateRecords(tableSpec: BaseJsonTableSpec, files: ConnectorFile[]): Promise<void> {
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
