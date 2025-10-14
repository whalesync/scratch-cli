import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from '../config/scratchpad-config.module';
import { BullEnqueuerService } from './bull-enqueuer.service';

@Module({
  imports: [ScratchpadConfigModule],
  providers: [BullEnqueuerService],
  exports: [BullEnqueuerService],
})
export class WorkerEnqueuerModule {}
