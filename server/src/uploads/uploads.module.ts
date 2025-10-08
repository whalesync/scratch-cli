import { Module } from '@nestjs/common';
import { SnapshotDbModule } from 'src/snapshot/snapshot-db.module';
import { DbModule } from '../db/db.module';
import { SnapshotModule } from '../snapshot/snapshot.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [SnapshotModule, SnapshotDbModule, DbModule],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
