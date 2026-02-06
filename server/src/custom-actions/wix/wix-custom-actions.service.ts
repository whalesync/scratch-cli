/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, NotImplementedException } from '@nestjs/common';
import { ValidatedWixPublishDraftPostsDto } from '@spinner/shared-types';
import { DbService } from 'src/db/db.service';
import { OAuthService } from 'src/oauth/oauth.service';
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { Actor } from 'src/users/types';
import { WorkbookService } from 'src/workbook/workbook.service';

@Injectable()
export class WixCustomActionsService {
  constructor(
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly oauthService: OAuthService,
    private readonly db: DbService,
    private readonly workbookService: WorkbookService,
  ) {}

  /**
   * Publish draft posts in Wix Blog
   */
  async publishDraftPosts(dto: ValidatedWixPublishDraftPostsDto, actor: Actor) {
    // WARN (chris) - Removed the functionailty from this function as it depended on the old SnapshotDB that was removed
    // but leaving the wiring here as a placeholder for a new implementation
    throw new NotImplementedException('This feature is not implemented');
  }
}
