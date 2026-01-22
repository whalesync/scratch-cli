import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthType } from '@prisma/client';
import {
  FileId,
  isFileId,
  Service,
  ValidatedWebflowPublishItemsDto,
  ValidatedWebflowPublishSiteDto,
  ValidatedWebflowValidateFilesDto,
  WebflowValidateFilesResponse,
  WorkbookId,
} from '@spinner/shared-types';
import matter from 'gray-matter';
import { DbService } from 'src/db/db.service';
import { OAuthService } from 'src/oauth/oauth.service';
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { WebflowTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';
import { WebflowCustomActions } from 'src/remote-service/connectors/library/webflow/custom-actions';
import { WebflowConnector } from 'src/remote-service/connectors/library/webflow/webflow-connector';
import { Actor } from 'src/users/types';
import { convertFileToConnectorRecord } from 'src/workbook/workbook-db';
import { WorkbookDbService } from 'src/workbook/workbook-db.service';
import { WorkbookService } from 'src/workbook/workbook.service';

@Injectable()
export class WebflowCustomActionsService {
  constructor(
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly oauthService: OAuthService,
    private readonly db: DbService,
    private readonly snapshotService: WorkbookService,
    private readonly workbookDbService: WorkbookDbService,
  ) {}

  /**
   * Publish items in a Webflow collection
   */
  async publishItems(dto: ValidatedWebflowPublishItemsDto, actor: Actor) {
    // Get the snapshot table and verify access through snapshot
    const snapshotTable = await this.getSnapshotTableWithAccess(dto.snapshotTableId, actor);

    // Verify the snapshot table has a connector account
    if (!snapshotTable.connectorAccountId) {
      throw new Error('Snapshot table does not have a connector account');
    }

    // Verify the connector account exists and user has access
    const connectorAccount = await this.connectorAccountService.findOne(snapshotTable.connectorAccountId, actor);

    // Verify it's a Webflow connector
    this.validateWebflowService({ service: connectorAccount.service as Service });

    // Get the table spec from the snapshot table (it's stored as JSON)
    const tableSpec = snapshotTable.tableSpec as unknown as WebflowTableSpec;

    // Query the actual records from the snapshot database
    const { records: snapshotRecords } = await this.snapshotService.getRecordsByIdsForAi(
      snapshotTable.workbookId as WorkbookId,
      snapshotTable.id,
      dto.recordIds,
      actor,
    );

    // Transform snapshot records to the format expected by Webflow custom actions
    // Filter out records without remoteIds (newly created records that haven't been synced yet)
    const records = snapshotRecords
      .filter((record) => record.id.remoteId !== null && record.id.remoteId !== '')
      .map((record) => ({
        wsId: record.id.wsId,
        remoteId: record.id.remoteId!, // remoteId is a string in Webflow
      }));

    // Validate that we have records to publish
    if (records.length === 0) {
      throw new Error(
        'No records with Webflow IDs found. Records must be synced with Webflow before they can be published.',
      );
    }

    // Warn if some records were filtered out
    if (records.length < snapshotRecords.length) {
      const skippedCount = snapshotRecords.length - records.length;
      console.warn(
        `Skipped ${skippedCount} record(s) without Webflow IDs. Only ${records.length} record(s) will be published.`,
      );
    }

    // Get the access token
    let accessToken: string;
    if (connectorAccount.authType === AuthType.OAUTH) {
      accessToken = await this.oauthService.getValidAccessToken(connectorAccount.id);
    } else {
      if (!connectorAccount.apiKey) {
        throw new Error('API key is required for Webflow');
      }
      accessToken = connectorAccount.apiKey;
    }

    // Initialize custom actions
    const customActions = new WebflowCustomActions(accessToken);

    // Publish the items
    const result = await customActions.publishItems({
      tableSpec,
      records,
    });

    return result;
  }

  /**
   * Publish a Webflow site
   */
  async publishSite(dto: ValidatedWebflowPublishSiteDto, actor: Actor) {
    // Get the snapshot table and verify access through snapshot
    const snapshotTable = await this.getSnapshotTableWithAccess(dto.snapshotTableId, actor);

    // Verify the snapshot table has a connector account
    if (!snapshotTable.connectorAccountId) {
      throw new Error('Snapshot table does not have a connector account');
    }

    // Verify the connector account exists and user has access
    const connectorAccount = await this.connectorAccountService.findOne(snapshotTable.connectorAccountId, actor);

    // Verify it's a Webflow connector
    this.validateWebflowService({ service: connectorAccount.service as Service });

    // Get the access token
    let accessToken: string;
    if (connectorAccount.authType === AuthType.OAUTH) {
      accessToken = await this.oauthService.getValidAccessToken(connectorAccount.id);
    } else {
      if (!connectorAccount.apiKey) {
        throw new Error('API key is required for Webflow');
      }
      accessToken = connectorAccount.apiKey;
    }

    // Get the table spec from the snapshot table (it's stored as JSON)
    const tableSpec = snapshotTable.tableSpec as unknown as WebflowTableSpec;

    // Initialize custom actions
    const customActions = new WebflowCustomActions(accessToken);

    // Publish the site
    const result = await customActions.publishSite({
      tableSpec,
    });

    return result;
  }

  /**
   * Validate files/records against the Webflow schema
   * Checks for missing required fields, unknown fields, and data type validation
   *
   * Supports three modes:
   * 1. Inline data (dto.files) - validates data sent directly from the client (preferred for UI)
   * 2. File IDs (fil_xxx) - fetches from files table (workbooks-md)
   * 3. Record IDs (snr_xxx) - fetches from snapshot database
   */
  async validateFiles(dto: ValidatedWebflowValidateFilesDto, actor: Actor): Promise<WebflowValidateFilesResponse> {
    // Get the snapshot table and verify access through snapshot
    const snapshotTable = await this.getSnapshotTableWithAccess(dto.snapshotTableId, actor);

    // Verify the snapshot table has a connector account
    if (!snapshotTable.connectorAccountId) {
      throw new Error('Snapshot table does not have a connector account');
    }

    // Verify the connector account exists and user has access
    const connectorAccount = await this.connectorAccountService.findOne(snapshotTable.connectorAccountId, actor);

    // Verify it's a Webflow connector
    this.validateWebflowService({ service: connectorAccount.service as Service });

    // Get the table spec from the snapshot table
    const tableSpec = snapshotTable.tableSpec as unknown as WebflowTableSpec;

    let filesToValidate: { filename: string; id?: string; data: Record<string, unknown> }[];
    let recordIdMapping: string[];

    // Mode 1: Inline file data provided - use directly without database lookup
    if (dto.files && dto.files.length > 0) {
      filesToValidate = dto.files.map((file) => {
        let data: Record<string, unknown>;

        if (file.data) {
          // Use pre-parsed data directly
          data = file.data;
        } else if (file.rawContent) {
          // Parse raw markdown content with frontmatter
          const parsed = matter(file.rawContent);
          data = { ...parsed.data };

          // Add body content to the main content field if tableSpec specifies one
          if (tableSpec.mainContentColumnRemoteId?.[0]) {
            data[tableSpec.mainContentColumnRemoteId[0]] = parsed.content;
          }
        } else {
          data = {};
        }

        return {
          filename: file.filename || 'unknown',
          id: file.id,
          data,
        };
      });
      recordIdMapping = dto.files.map((f, i) => f.id || `inline-${i}`);
    }
    // Mode 2 & 3: Fetch from database based on record IDs
    else if (dto.recordIds && dto.recordIds.length > 0) {
      const workbookId = snapshotTable.workbookId as WorkbookId;

      // Check if we're dealing with file IDs (from workbooks-md) or snapshot record IDs
      const isFileBasedValidation = isFileId(dto.recordIds[0]);

      if (isFileBasedValidation) {
        // Fetch files from the files table
        const files = await this.workbookDbService.workbookDb.getFilesByIds(workbookId, dto.recordIds as FileId[]);

        if (files.length === 0) {
          return {
            results: [],
            summary: { total: 0, publishable: 0, invalid: 0 },
          };
        }

        // Convert files to validation format using the existing helper
        filesToValidate = files.map((file) => {
          const connectorRecord = convertFileToConnectorRecord(workbookId, file, tableSpec);
          const filename =
            (connectorRecord.fields['name'] as string) || (connectorRecord.fields['slug'] as string) || file.name;

          return {
            filename,
            id: file.remote_id || undefined,
            data: connectorRecord.fields,
          };
        });

        recordIdMapping = files.map((f) => f.id);
      } else {
        // Fetch records from the snapshot database
        const { records: snapshotRecords } = await this.snapshotService.getRecordsByIdsForAi(
          workbookId,
          snapshotTable.id,
          dto.recordIds,
          actor,
        );

        if (snapshotRecords.length === 0) {
          return {
            results: [],
            summary: { total: 0, publishable: 0, invalid: 0 },
          };
        }

        filesToValidate = snapshotRecords.map((record) => {
          const filename =
            (record.fields['name'] as string) || (record.fields['slug'] as string) || record.id.wsId.toString();

          return {
            filename,
            id: record.id.remoteId || undefined,
            data: record.fields,
          };
        });

        recordIdMapping = snapshotRecords.map((r) => r.id.wsId);
      }
    } else {
      throw new Error('Either files or recordIds must be provided for validation');
    }

    // Create a temporary connector instance just for validation (no API key needed)
    const connector = new WebflowConnector('validation-only');

    // Run validation
    const validationResults = await connector.validateFiles(tableSpec, filesToValidate);

    // Map results back to record IDs
    const results = validationResults.map((result, index) => ({
      recordId: recordIdMapping[index],
      filename: result.filename,
      publishable: result.publishable,
      errors: result.errors,
    }));

    const publishableCount = results.filter((r) => r.publishable).length;

    return {
      results,
      summary: {
        total: results.length,
        publishable: publishableCount,
        invalid: results.length - publishableCount,
      },
    };
  }

  /**
   * Validates that the connector account is a Webflow service
   */
  private validateWebflowService(connectorAccount: { service: Service }) {
    if (connectorAccount.service !== Service.WEBFLOW) {
      throw new Error('Connector account must be a Webflow service');
    }
  }

  /**
   * Gets a snapshot table and verifies the user has access through the parent snapshot
   */
  private async getSnapshotTableWithAccess(snapshotTableId: string, actor: Actor) {
    // First get the snapshot table to find its parent Workbook
    const snapshotTable = await this.db.client.snapshotTable.findUniqueOrThrow({
      where: { id: snapshotTableId },
    });

    // Verify the user has access to the parent snapshot (this enforces organization-level access control)
    const workbook = await this.snapshotService.findOne(snapshotTable.workbookId as WorkbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found or access denied');
    }

    // Verify the snapshot table is still part of the snapshot
    const foundTable = workbook.snapshotTables?.find((t) => t.id === snapshotTableId);
    if (!foundTable) {
      throw new NotFoundException('Snapshot table not found in Workbook');
    }

    return foundTable;
  }
}
