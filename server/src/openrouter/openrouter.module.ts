import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { OpenRouterService } from './openrouter.service';

@Module({
  providers: [OpenRouterService],
  imports: [ScratchpadConfigModule],
  exports: [OpenRouterService],
  controllers: [],
})
export class OpenRouterModule {}
