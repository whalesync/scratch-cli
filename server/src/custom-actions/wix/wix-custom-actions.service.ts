import { Injectable, NotFoundException } from '@nestjs/common';
import { Service, ValidatedWixPublishDraftPostsDto, WorkbookId } from '@spinner/shared-types';
import { DbService } from 'src/db/db.service';
import { OAuthService } from 'src/oauth/oauth.service';
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { WixBlogTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';
import { WixCustomActions } from 'src/remote-service/connectors/library/wix/custom-actions';
import { Actor } from 'src/users/types';
import { WorkbookService } from 'src/workbook/workbook.service';

@Injectable()
export class WixCustomActionsService {
  constructor(
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly oauthService: OAuthService,
    private readonly db: DbService,
    private readonly snapshotService: WorkbookService,
  ) {}

  /**
   * Publish draft posts in Wix Blog
   */
  async publishDraftPosts(dto: ValidatedWixPublishDraftPostsDto, actor: Actor) {
    // Get the snapshot table and verify access through snapshot
    const snapshotTable = await this.getSnapshotTableWithAccess(dto.snapshotTableId, actor);

    // Verify the snapshot table has a connector account
    if (!snapshotTable.connectorAccountId) {
      throw new Error('Snapshot table does not have a connector account');
    }

    // Verify the connector account exists and user has access
    const connectorAccount = await this.connectorAccountService.findOne(snapshotTable.connectorAccountId, actor);

    // Verify it's a Wix Blog connector
    this.validateWixBlogService({ service: connectorAccount.service as Service });

    // Get the table spec from the snapshot table (it's stored as JSON)
    const tableSpec = snapshotTable.tableSpec as unknown as WixBlogTableSpec;

    // Query the actual records from the snapshot database
    const { records: snapshotRecords } = await this.snapshotService.getRecordsByIdsForAi(
      snapshotTable.workbookId as WorkbookId,
      tableSpec.id.wsId,
      dto.recordIds,
      actor,
    );

    // Transform snapshot records to the format expected by Wix custom actions
    // Filter out records without remoteIds (newly created records that haven't been synced yet)
    const records = snapshotRecords
      .filter((record) => record.id.remoteId !== null && record.id.remoteId !== '')
      .map((record) => ({
        wsId: record.id.wsId,
        remoteId: record.id.remoteId!, // remoteId is the draft post ID
      }));

    // Validate that we have records to publish
    if (records.length === 0) {
      throw new Error(
        'No records with Wix draft post IDs found. Records must be synced with Wix before they can be published.',
      );
    }

    // Warn if some records were filtered out
    if (records.length < snapshotRecords.length) {
      const skippedCount = snapshotRecords.length - records.length;
      console.warn(
        `Skipped ${skippedCount} record(s) without Wix draft post IDs. Only ${records.length} record(s) will be published.`,
      );
    }

    // Get the access token
    const accessToken = await this.oauthService.getValidAccessToken(connectorAccount.id);

    // Initialize custom actions
    const customActions = new WixCustomActions(accessToken);

    // Publish the draft posts
    const result = await customActions.publishDraftPosts({
      tableSpec,
      records,
    });

    return result;
  }

  /**
   * Validates that the connector account is a Wix Blog service
   */
  private validateWixBlogService(connectorAccount: { service: Service }) {
    if (connectorAccount.service !== Service.WIX_BLOG) {
      throw new Error('Connector account must be a Wix Blog service');
    }
  }

  /**
   * Gets a snapshot table and verifies the user has access through the parent Workbook
   */
  private async getSnapshotTableWithAccess(snapshotTableId: string, actor: Actor) {
    // First get the snapshot table to find its parent snapshot
    const snapshotTable = await this.db.client.snapshotTable.findUniqueOrThrow({
      where: { id: snapshotTableId },
    });

    // Verify the user has access to the parent Workbook (this enforces organization-level access control)
    const workbook = await this.snapshotService.findOne(snapshotTable.workbookId as WorkbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found or access denied');
    }

    // Verify the snapshot table is still part of the Workbook
    const foundTable = workbook.snapshotTables?.find((t) => t.id === snapshotTableId);
    if (!foundTable) {
      throw new NotFoundException('Snapshot table not found in Workbook');
    }

    return foundTable;
  }
}
