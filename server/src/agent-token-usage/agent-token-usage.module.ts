import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AgentTokenUsageController } from './agent-token-usage.controller';
import { AgentTokenUsageService } from './agent-token-usage.service';

@Module({
  providers: [AgentTokenUsageService],
  imports: [DbModule],
  exports: [AgentTokenUsageService],
  controllers: [AgentTokenUsageController],
})
export class AgentTokenUsageModule {}
