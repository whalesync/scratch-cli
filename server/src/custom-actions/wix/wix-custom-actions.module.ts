import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { OAuthModule } from '../../oauth/oauth.module';
import { ConnectorAccountModule } from '../../remote-service/connector-account/connector-account.module';
import { SnapshotModule } from '../../snapshot/snapshot.module';
import { WixCustomActionsController } from './wix-custom-actions.controller';
import { WixCustomActionsService } from './wix-custom-actions.service';

@Module({
  imports: [ConnectorAccountModule, OAuthModule, DbModule, SnapshotModule],
  controllers: [WixCustomActionsController],
  providers: [WixCustomActionsService],
  exports: [WixCustomActionsService],
})
export class WixCustomActionsModule {}
