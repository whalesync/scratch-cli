import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { ConnectorsModule } from '../remote-service/connectors/connectors.module';
import { SnapshotDbService } from './snapshot-db.service';
import { SnapshotEventService } from './snapshot-event.service';
import { SnapshotController } from './snapshot.controller';
import { SnapshotService } from './snapshot.service';

@Module({
  imports: [DbModule, ConnectorsModule, ScratchpadConfigModule],
  controllers: [SnapshotController],
  providers: [SnapshotService, SnapshotDbService, SnapshotEventService],
  exports: [SnapshotService, SnapshotEventService],
})
export class SnapshotModule {}
