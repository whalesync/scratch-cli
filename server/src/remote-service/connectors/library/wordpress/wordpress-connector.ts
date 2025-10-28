import { Service } from '@prisma/client';
import MarkdownIt from 'markdown-it';
import { SnapshotColumnContexts } from 'src/snapshot/types';
import TurndownService from 'turndown';
import { Connector } from '../../connector';
import { sanitizeForWsId } from '../../ids';
import { ConnectorErrorDetails, ConnectorRecord, EntityId, TablePreview } from '../../types';
import { WordPressTableSpec } from '../custom-spec-registry';
import {
  WORDPRESS_CREATE_UNSUPPORTED_TABLE_IDS,
  WORDPRESS_DEFAULT_TABLE_IDS,
  WORDPRESS_POLLING_PAGE_SIZE,
  WORDPRESS_REMOTE_CUSTOM_FIELDS_ID,
} from './wordpress-constants';
import { WordPressHttpClient } from './wordpress-http-client';
import { parseColumnsFromTableId, parseTableInfoFromTypes } from './wordpress-schema-parser';
import { WordPressDataType, WordPressDownloadProgress, WordPressRecord } from './wordpress-types';

export class WordPressConnector extends Connector<typeof Service.WORDPRESS, WordPressDownloadProgress> {
  readonly service = Service.WORDPRESS;
  private client: WordPressHttpClient;
  private readonly turndownService: TurndownService = new TurndownService({
    headingStyle: 'atx',
  });

  constructor(username: string, password: string, endpoint: string) {
    super();
    this.client = new WordPressHttpClient(endpoint, username, password);
  }

  displayName(): string {
    return 'WordPress';
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
        wsId: sanitizeForWsId(tableId),
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
      name: sanitizeForWsId(tableId),
      columns,
    };
  }

  async downloadTableRecords(
    tableSpec: WordPressTableSpec,
    columnContexts: SnapshotColumnContexts,
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
        this.wordPressRecordToConnectorRecord(wpRecord, tableSpec, columnContexts),
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

  getBatchSize(): number {
    return 1;
  }

  async createRecords(
    tableSpec: WordPressTableSpec,
    columnContexts: SnapshotColumnContexts,
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
        columnContexts,
        Object.keys(record.fields),
      );
      const created = await this.client.createRecord(tableId, wpRecord);
      results.push({ wsId: record.wsId, remoteId: String(created.id) });
    }

    return results;
  }

  async updateRecords(
    tableSpec: WordPressTableSpec,
    columnContexts: SnapshotColumnContexts,
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
        columnContexts,
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
    columnContexts: SnapshotColumnContexts,
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
            if (column && value !== undefined) {
              record.fields[column.id.wsId] = value;
            }
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
            const dataConverter = columnContexts[tableSpec.id.wsId]?.[column.id.wsId]?.dataConverter;
            const rendered = (value as { rendered: string }).rendered;
            if (dataConverter === 'html' || !dataConverter) {
              record.fields[column.id.wsId] = rendered;
            } else if (dataConverter === 'markdown') {
              const markdownContent = String(this.turndownService.turndown(rendered));
              record.fields[column.id.wsId] = markdownContent;
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
    columnContexts: SnapshotColumnContexts,
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
      if (column.wordpressDataType === WordPressDataType.RENDERED) {
        const dataConverter = columnContexts[tableSpec.id.wsId]?.[column.id.wsId]?.dataConverter;
        if (dataConverter === 'html' || !dataConverter) {
          wpRecord[remoteId] = value;
        } else if (dataConverter === 'markdown') {
          const converter = MarkdownIt({});
          const markdownContent = converter.render(String(value));
          wpRecord[remoteId] = markdownContent;
        }
      } else {
        wpRecord[remoteId] = value;
      }
    }

    return wpRecord;
  }

  extractConnectorErrorDetails(error: unknown): ConnectorErrorDetails {
    // TODO - parse the error more gracefully and return more specific error details.

    return {
      userFriendlyMessage: 'An error occurred while connecting to YouTube',
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
