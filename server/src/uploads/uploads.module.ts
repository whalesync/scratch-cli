import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { SnapshotDbModule } from 'src/snapshot/snapshot-db.module';
import { DbModule } from '../db/db.module';
import { UploadsDbService } from './uploads-db.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [DbModule, ScratchpadConfigModule, SnapshotDbModule],
  controllers: [UploadsController],
  providers: [UploadsService, UploadsDbService],
  exports: [UploadsService, UploadsDbService],
})
export class UploadsModule {}
