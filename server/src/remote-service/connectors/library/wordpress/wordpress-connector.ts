import { Service } from '@spinner/shared-types';
import { isAxiosError } from 'axios';
import MarkdownIt from 'markdown-it';
import { WSLogger } from 'src/logger';
import type { SnapshotColumnSettingsMap } from 'src/workbook/types';
import TurndownService from 'turndown';
import { Connector } from '../../connector';
import { extractErrorMessageFromAxiosError } from '../../error';
import { validate } from '../../file-validator';
import { sanitizeForTableWsId } from '../../ids';
import {
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
import {
  parseColumnsFromTableId,
  parseTableInfoFromTypes,
  WORDPRESS_RICH_TEXT_TARGET,
} from './wordpress-schema-parser';
import { WordPressDataType, WordPressDownloadProgress, WordPressRecord } from './wordpress-types';

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

  async fetchTableSpec(id: EntityId): Promise<WordPressTableSpec> {
    const [tableId] = id.remoteId;
    const optionsResponse = await this.client.getEndpointOptions(tableId);
    const columns = parseColumnsFromTableId(tableId, optionsResponse);

    return {
      id,
      slug: id.wsId,
      name: sanitizeForTableWsId(tableId),
      columns,
    };
  }

  async downloadTableRecords(
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

  public downloadRecordDeep = undefined;

  async downloadRecordFiles(
    tableSpec: WordPressTableSpec,
    callback: (params: { files: ConnectorFile[]; connectorProgress?: WordPressDownloadProgress }) => Promise<void>,
    progress: WordPressDownloadProgress,
  ): Promise<void> {
    WSLogger.info({ source: 'WordPressConnector', message: 'downloadRecordFiles called', tableId: tableSpec.id.wsId });
    await callback({ files: [], connectorProgress: progress });
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

  async createRecords(
    tableSpec: WordPressTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
    records: { wsId: string; fields: Record<string, unknown> }[],
  ): Promise<{ wsId: string; remoteId: string }[]> {
    const [tableId] = tableSpec.id.remoteId;

    // Check if this table supports create
    if (WORDPRESS_CREATE_UNSUPPORTED_TABLE_IDS.includes(tableId)) {
      throw new Error(`Table "${tableId}" does not support record creation`);
    }

    const results: { wsId: string; remoteId: string }[] = [];

    for (const record of records) {
      const wpRecord = this.connectorFieldsToWordPressRecord(
        record.fields,
        tableSpec,
        columnSettingsMap,
        Object.keys(record.fields),
      );
      const created = await this.client.createRecord(tableId, wpRecord);
      results.push({ wsId: record.wsId, remoteId: String(created.id) });
    }

    return results;
  }

  async updateRecords(
    tableSpec: WordPressTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
    records: {
      id: { wsId: string; remoteId: string };
      partialFields: Record<string, unknown>;
    }[],
  ): Promise<void> {
    const [tableId] = tableSpec.id.remoteId;

    for (const record of records) {
      const modifiedColumns = Object.keys(record.partialFields);
      const wpRecord = this.connectorFieldsToWordPressRecord(
        record.partialFields,
        tableSpec,
        columnSettingsMap,
        modifiedColumns,
      );
      await this.client.updateRecord(tableId, record.id.remoteId, wpRecord);
    }
  }

  async deleteRecords(tableSpec: WordPressTableSpec, recordIds: { wsId: string; remoteId: string }[]): Promise<void> {
    const [tableId] = tableSpec.id.remoteId;

    for (const recordId of recordIds) {
      await this.client.deleteRecord(tableId, recordId.remoteId);
    }
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

  /**
   * Convert ConnectorRecord fields to a WordPress record
   */
  private connectorFieldsToWordPressRecord(
    fields: Record<string, unknown>,
    tableSpec: WordPressTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
    modifiedColumns: string[],
  ): WordPressRecord {
    const wpRecord: WordPressRecord = {};

    for (const wsId of modifiedColumns) {
      const column = tableSpec.columns.find((c) => c.id.wsId === wsId);
      if (!column || column.readonly) {
        continue;
      }
      const value = fields[wsId];
      const remoteId = column.id.remoteId[0];
      if (
        column.wordpressDataType === WordPressDataType.RENDERED ||
        column.wordpressDataType === WordPressDataType.RENDERED_INLINE
      ) {
        const dataConverter = columnSettingsMap[column.id.wsId]?.dataConverter;
        switch (dataConverter) {
          case WORDPRESS_RICH_TEXT_TARGET.MARKDOWN: {
            const converter = MarkdownIt({});
            const inline = column.wordpressDataType === WordPressDataType.RENDERED_INLINE;
            const markdownContent = inline ? converter.renderInline(String(value)) : converter.render(String(value));
            wpRecord[remoteId] = markdownContent;
            break;
          }
          case WORDPRESS_RICH_TEXT_TARGET.HTML:
          default: {
            wpRecord[remoteId] = value;
            break;
          }
        }
      } else {
        wpRecord[remoteId] = value;
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

/**
 * Format a table name for display
 */
function formatTableName(tableId: string): string {
  return tableId
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
