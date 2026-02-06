/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { AuthType } from '@prisma/client';
import {
  Service,
  ValidatedWebflowPublishItemsDto,
  ValidatedWebflowPublishSiteDto,
  ValidatedWebflowValidateFilesDto,
  WebflowValidateFilesResponse,
  WorkbookId,
} from '@spinner/shared-types';
import { DbService } from 'src/db/db.service';
import { OAuthService } from 'src/oauth/oauth.service';
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { WebflowTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';
import { WebflowCustomActions } from 'src/remote-service/connectors/library/webflow/custom-actions';
import { Actor } from 'src/users/types';
import { WorkbookService } from 'src/workbook/workbook.service';

@Injectable()
export class WebflowCustomActionsService {
  constructor(
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly oauthService: OAuthService,
    private readonly db: DbService,
    private readonly workbookService: WorkbookService,
  ) {}

  /**
   * Publish items in a Webflow collection
   */
  async publishItems(dto: ValidatedWebflowPublishItemsDto, actor: Actor) {
    // WARN (chris) - Removed the functionailty from this function as it depended on the old SnapshotDB that was removed
    // but leaving the wiring here as a placeholder for a new implementation
    throw new NotImplementedException('This feature is not implemented');
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
   */
  async validateFiles(dto: ValidatedWebflowValidateFilesDto, actor: Actor): Promise<WebflowValidateFilesResponse> {
    // WARN (chris) - Removed the functionailty from this function as it depended on the old SnapshotDB that was removed
    // but leaving the wiring here as a placeholder for a new implementation
    throw new NotImplementedException('This feature is not implemented');
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
    const workbook = await this.workbookService.findOne(snapshotTable.workbookId as WorkbookId, actor);
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
