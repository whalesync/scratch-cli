import { Module } from '@nestjs/common';
import { DbModule } from 'src/db/db.module';
import { ConnectorsModule } from '../remote-service/connectors/connectors.module';
import { SnapshotDbService } from './snapshot-db.service';
import { SnapshotController } from './snapshot.controller';
import { SnapshotService } from './snapshot.service';

@Module({
  imports: [DbModule, ConnectorsModule],
  controllers: [SnapshotController],
  providers: [SnapshotService, SnapshotDbService],
  exports: [SnapshotService],
})
export class SnapshotModule {}
