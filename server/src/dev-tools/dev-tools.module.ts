import { Module } from '@nestjs/common';
import { DbModule } from 'src/db/db.module';
import { ConnectorAccountModule } from 'src/remote-service/connector-account/connector-account.module';
import { SnapshotModule } from 'src/snapshot/snapshot.module';
import { UserModule } from 'src/users/users.module';
import { DevToolsController } from './dev-tools.controller';
import { DevToolsService } from './dev-tools.service';

@Module({
  providers: [DevToolsService],
  imports: [DbModule, UserModule, SnapshotModule, ConnectorAccountModule],
  exports: [], //export this service to use in other modules
  controllers: [DevToolsController],
})
export class DevToolsModule {}
