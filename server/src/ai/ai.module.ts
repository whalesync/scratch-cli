import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { AiService } from './ai.service';

@Module({
  imports: [ScratchpadConfigModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
