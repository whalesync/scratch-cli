import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { ExperimentsService } from './experiments.service';

@Module({
  imports: [ScratchpadConfigModule],
  controllers: [],
  providers: [ExperimentsService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
