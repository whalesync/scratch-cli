import { Module } from '@nestjs/common';
import { DbModule } from 'src/db/db.module';
import { UploadsModule } from 'src/uploads/uploads.module';
import { SnapshotDbModule } from 'src/workbook/snapshot-db.module';
import { WorkbookModule } from 'src/workbook/workbook.module';
import { MentionsController } from './mentions.controller';
import { MentionsService } from './mentions.service';

@Module({
  imports: [UploadsModule, WorkbookModule, SnapshotDbModule, DbModule],
  controllers: [MentionsController],
  providers: [MentionsService],
})
export class MentionsModule {}
