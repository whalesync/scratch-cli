import { Module } from '@nestjs/common';
import { DbModule } from 'src/db/db.module';
import { SnapshotDbModule } from 'src/snapshot/snapshot-db.module';
import { SnapshotModule } from 'src/snapshot/snapshot.module';
import { UploadsModule } from 'src/uploads/uploads.module';
import { MentionsController } from './mentions.controller';
import { MentionsService } from './mentions.service';

@Module({
  imports: [UploadsModule, SnapshotModule, SnapshotDbModule, DbModule],
  controllers: [MentionsController],
  providers: [MentionsService],
})
export class MentionsModule {}
