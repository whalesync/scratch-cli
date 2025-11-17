import { Injectable, NotFoundException } from '@nestjs/common';
import { Service } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import { OAuthService } from 'src/oauth/oauth.service';
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { WebflowTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';
import { WebflowCustomActions } from 'src/remote-service/connectors/library/webflow/custom-actions';
import { SnapshotService } from 'src/snapshot/snapshot.service';
import { SnapshotId } from 'src/types/ids';
import { Actor } from 'src/users/types';
import { WebflowPublishItemsDto } from './dto/publish-items.dto';
import { WebflowPublishSiteDto } from './dto/publish-site.dto';

@Injectable()
export class WebflowCustomActionsService {
  constructor(
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly oauthService: OAuthService,
    private readonly db: DbService,
    private readonly snapshotService: SnapshotService,
  ) {}

  /**
   * Publish items in a Webflow collection
   */
  async publishItems(dto: WebflowPublishItemsDto, actor: Actor) {
    // Get the snapshot table and verify access through snapshot
    const snapshotTable = await this.getSnapshotTableWithAccess(dto.snapshotTableId, actor);

    // Verify the snapshot table has a connector account
    if (!snapshotTable.connectorAccountId) {
      throw new Error('Snapshot table does not have a connector account');
    }

    // Verify the connector account exists and user has access
    const connectorAccount = await this.connectorAccountService.findOne(snapshotTable.connectorAccountId, actor);

    // Verify it's a Webflow connector
    this.validateWebflowService(connectorAccount);

    // Get the table spec from the snapshot table (it's stored as JSON)
    const tableSpec = snapshotTable.tableSpec as unknown as WebflowTableSpec;

    // Query the actual records from the snapshot database
    const { records: snapshotRecords } = await this.snapshotService.getRecordsByIdsForAi(
      snapshotTable.snapshotId as SnapshotId,
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
    const accessToken = await this.oauthService.getValidAccessToken(connectorAccount.id);

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
  async publishSite(dto: WebflowPublishSiteDto, actor: Actor) {
    // Get the snapshot table and verify access through snapshot
    const snapshotTable = await this.getSnapshotTableWithAccess(dto.snapshotTableId, actor);

    // Verify the snapshot table has a connector account
    if (!snapshotTable.connectorAccountId) {
      throw new Error('Snapshot table does not have a connector account');
    }

    // Verify the connector account exists and user has access
    const connectorAccount = await this.connectorAccountService.findOne(snapshotTable.connectorAccountId, actor);

    // Verify it's a Webflow connector
    this.validateWebflowService(connectorAccount);

    // Get the access token
    const accessToken = await this.oauthService.getValidAccessToken(connectorAccount.id);

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
    // First get the snapshot table to find its parent snapshot
    const snapshotTable = await this.db.client.snapshotTable.findUniqueOrThrow({
      where: { id: snapshotTableId },
    });

    // Verify the user has access to the parent snapshot (this enforces organization-level access control)
    const snapshot = await this.snapshotService.findOne(snapshotTable.snapshotId as SnapshotId, actor);
    if (!snapshot) {
      throw new NotFoundException('Snapshot not found or access denied');
    }

    // Verify the snapshot table is still part of the snapshot
    const foundTable = snapshot.snapshotTables?.find((t) => t.id === snapshotTableId);
    if (!foundTable) {
      throw new NotFoundException('Snapshot table not found in snapshot');
    }

    return foundTable;
  }
}
