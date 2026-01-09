import { Module } from '@nestjs/common';
import { SnapshotDbModule } from 'src/workbook/snapshot-db.module';
import { WorkbookModule } from 'src/workbook/workbook.module';
import { MentionsController } from './mentions.controller';
import { MentionsService } from './mentions.service';

@Module({
  imports: [WorkbookModule, SnapshotDbModule],
  controllers: [MentionsController],
  providers: [MentionsService],
})
export class MentionsModule {}
