import { Module } from '@nestjs/common';
import { ClerkModule } from 'src/clerk/clerk.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { UserModule } from 'src/users/users.module';
import { ConnectorsModule } from '../remote-service/connectors/connectors.module';
import { AiSnapshotController } from './ai-snapshot.controller';
import { SnapshotDbService } from './snapshot-db.service';
import { SnapshotEventService } from './snapshot-event.service';
import { SnapshotController } from './snapshot.controller';
import { SnapshotDataGateway } from './snapshot.gateway';
import { SnapshotService } from './snapshot.service';

@Module({
  imports: [DbModule, ConnectorsModule, ScratchpadConfigModule, ClerkModule, UserModule],
  controllers: [SnapshotController, AiSnapshotController],
  providers: [SnapshotService, SnapshotDbService, SnapshotEventService, SnapshotDataGateway],
  exports: [SnapshotService],
})
export class SnapshotModule {}
