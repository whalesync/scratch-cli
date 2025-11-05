import { Module } from '@nestjs/common';
import { DbModule } from 'src/db/db.module';
import { SnapshotDbService } from './snapshot-db.service';

@Module({
  imports: [DbModule],
  providers: [SnapshotDbService],
  exports: [SnapshotDbService],
})
export class SnapshotDbModule {}
