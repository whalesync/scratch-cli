import { Service } from '@prisma/client';
import _ from 'lodash';
import MarkdownIt from 'markdown-it';
import { JsonSafeObject, JsonSafeValue } from 'src/utils/objects';
import type { SnapshotColumnSettingsMap } from 'src/workbook/types';
import TurndownService from 'turndown';
import { Webflow, WebflowClient, WebflowError } from 'webflow-api';
import { minifyHtml } from '../../../../wrappers/html-minify';
import { Connector } from '../../connector';
import { ConnectorErrorDetails, ConnectorRecord, EntityId, TablePreview } from '../../types';
import { WebflowTableSpec } from '../custom-spec-registry';
import { WebflowSchemaParser } from './webflow-schema-parser';
import { WEBFLOW_METADATA_COLUMNS, WebflowItemMetadata } from './webflow-spec-types';

export const WEBFLOW_DEFAULT_BATCH_SIZE = 100;

export class WebflowConnector extends Connector<typeof Service.WEBFLOW> {
  readonly service = Service.WEBFLOW;
  static readonly displayName = 'Webflow';

  private readonly turndownService: TurndownService = new TurndownService({
    headingStyle: 'atx',
  });
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

  async downloadTableRecords(
    tableSpec: WebflowTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
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

      const records = this.wireToConnectorRecord(items, tableSpec, columnSettingsMap);
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
  private wireToConnectorRecord(
    items: Webflow.CollectionItem[],
    tableSpec: WebflowTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
  ): ConnectorRecord[] {
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
          if (column.webflowFieldType === Webflow.FieldType.RichText) {
            const dataConverter = columnSettingsMap[column.id.wsId]?.dataConverter;
            if (dataConverter === 'html') {
              record.fields[fieldId] = fieldValue;
            } else {
              record.fields[fieldId] = this.turndownService.turndown(fieldValue as string);
            }
          } else {
            record.fields[fieldId] = fieldValue;
          }
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
    columnSettingsMap: SnapshotColumnSettingsMap,
    records: { wsId: string; fields: Record<string, unknown> }[],
  ): Promise<{ wsId: string; remoteId: string }[]> {
    const [, collectionId] = tableSpec.id.remoteId;

    const fieldData: Webflow.collections.CreateBulkCollectionItemRequestBodyFieldData[] = [];
    for (const record of records) {
      const fields = await this.wsFieldsToWebflowFields(record.fields, tableSpec, columnSettingsMap);
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
    columnSettingsMap: SnapshotColumnSettingsMap,
    records: {
      id: { wsId: string; remoteId: string };
      partialFields: Record<string, unknown>;
    }[],
  ): Promise<void> {
    const [, collectionId] = tableSpec.id.remoteId;

    const items: { id: string; fieldData: Webflow.CollectionItemFieldData }[] = [];
    for (const record of records) {
      const fieldData = await this.wsFieldsToWebflowFields(record.partialFields, tableSpec, columnSettingsMap);
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
    columnSettingsMap: SnapshotColumnSettingsMap,
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
          const dataConverter = columnSettingsMap[column.id.wsId]?.dataConverter;
          let html: string = '';
          if (dataConverter === 'html') {
            html = wsValue as string;
          } else {
            html = MarkdownIt({}).render(wsValue as string);
          }
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
