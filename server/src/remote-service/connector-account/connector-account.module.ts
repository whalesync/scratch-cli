import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { PosthogModule } from '../../posthog/posthog.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { ConnectorAccountController } from './connector-account.controller';
import { ConnectorAccountService } from './connector-account.service';

@Module({
  imports: [DbModule, ConnectorsModule, PosthogModule],
  controllers: [ConnectorAccountController],
  providers: [ConnectorAccountService],
  exports: [ConnectorAccountService],
})
export class ConnectorAccountModule {}
