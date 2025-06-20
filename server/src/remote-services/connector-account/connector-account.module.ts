import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { ConnectorAccountController } from './connector-account.controller';
import { ConnectorAccountService } from './connector-account.service';

@Module({
  imports: [DbModule, ConnectorsModule],
  controllers: [ConnectorAccountController],
  providers: [ConnectorAccountService],
})
export class ConnectorAccountModule {}
