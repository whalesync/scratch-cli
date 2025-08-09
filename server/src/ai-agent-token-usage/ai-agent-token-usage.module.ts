import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AiAgentTokenUsageController } from './ai-agent-token-usage.controller';
import { AiAgentTokenUsageService } from './ai-agent-token-usage.service';

@Module({
  providers: [AiAgentTokenUsageService],
  imports: [DbModule],
  exports: [AiAgentTokenUsageService],
  controllers: [AiAgentTokenUsageController],
})
export class AiAgentTokenUsageModule {}
