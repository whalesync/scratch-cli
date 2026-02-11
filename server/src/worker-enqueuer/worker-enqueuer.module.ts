import { Module } from '@nestjs/common';
import { ScratchConfigModule } from '../config/scratch-config.module';
import { JobModule } from '../job/job.module';
import { BullEnqueuerService } from './bull-enqueuer.service';

@Module({
  imports: [ScratchConfigModule, JobModule],
  providers: [BullEnqueuerService],
  exports: [BullEnqueuerService],
})
export class WorkerEnqueuerModule {}
