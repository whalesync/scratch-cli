import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { UserModule } from 'src/users/users.module';
import { SnapshotDbModule } from 'src/workbook/snapshot-db.module';
import { DbModule } from '../db/db.module';
import { UploadsDbService } from './uploads-db.service';
import { UploadsPublicController } from './uploads-public.controller';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [DbModule, ScratchpadConfigModule, SnapshotDbModule, UserModule],
  controllers: [UploadsController, UploadsPublicController],
  providers: [UploadsService, UploadsDbService],
  exports: [UploadsService, UploadsDbService],
})
export class UploadsModule {}
