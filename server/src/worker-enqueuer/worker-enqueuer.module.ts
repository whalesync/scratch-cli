import { Module } from '@nestjs/common';
import { ScratchConfigModule } from '../config/scratch-config.module';
import { BullEnqueuerService } from './bull-enqueuer.service';

@Module({
  imports: [ScratchConfigModule],
  providers: [BullEnqueuerService],
  exports: [BullEnqueuerService],
})
export class WorkerEnqueuerModule {}
