import { Module } from '@nestjs/common';
import { ScratchConfigModule } from 'src/config/scratch-config.module';
import { ExperimentsService } from './experiments.service';

@Module({
  imports: [ScratchConfigModule],
  controllers: [],
  providers: [ExperimentsService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
