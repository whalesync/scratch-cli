import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { SnapshotDbService } from './snapshot-db.service';

@Module({
  imports: [ScratchpadConfigModule],
  providers: [SnapshotDbService],
  exports: [SnapshotDbService],
})
export class SnapshotDbModule {}
