import { Module } from '@nestjs/common';
import { DbModule } from 'src/db/db.module';
import { ConnectorsModule } from '../remote-services/connectors/connectors.module';
import { SnapshotController } from './snapshot.controller';
import { SnapshotService } from './snapshot.service';

@Module({
  imports: [DbModule, ConnectorsModule],
  controllers: [SnapshotController],
  providers: [SnapshotService],
  exports: [SnapshotService],
})
export class SnapshotModule {}
