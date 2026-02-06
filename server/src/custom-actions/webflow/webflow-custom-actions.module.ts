import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { OAuthModule } from '../../oauth/oauth.module';
import { ConnectorAccountModule } from '../../remote-service/connector-account/connector-account.module';
import { WorkbookModule } from '../../workbook/workbook.module';
import { WebflowCustomActionsController } from './webflow-custom-actions.controller';
import { WebflowCustomActionsService } from './webflow-custom-actions.service';

@Module({
  imports: [ConnectorAccountModule, OAuthModule, DbModule, WorkbookModule],
  controllers: [WebflowCustomActionsController],
  providers: [WebflowCustomActionsService],
  exports: [WebflowCustomActionsService],
})
export class WebflowCustomActionsModule {}
