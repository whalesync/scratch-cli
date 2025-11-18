import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { OAuthModule } from '../../oauth/oauth.module';
import { ConnectorAccountModule } from '../../remote-service/connector-account/connector-account.module';
import { WorkbookModule } from '../../workbook/workbook.module';
import { WixCustomActionsController } from './wix-custom-actions.controller';
import { WixCustomActionsService } from './wix-custom-actions.service';

@Module({
  imports: [ConnectorAccountModule, OAuthModule, DbModule, WorkbookModule],
  controllers: [WixCustomActionsController],
  providers: [WixCustomActionsService],
  exports: [WixCustomActionsService],
})
export class WixCustomActionsModule {}
