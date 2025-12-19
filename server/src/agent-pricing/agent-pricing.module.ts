import { Module } from '@nestjs/common';
import { OpenRouterModule } from '../openrouter/openrouter.module';
import { AgentPricingController } from './agent-pricing.controller';
import { AgentPricingService } from './agent-pricing.service';

@Module({
  imports: [OpenRouterModule],
  controllers: [AgentPricingController],
  providers: [AgentPricingService],
  exports: [AgentPricingService],
})
export class AgentPricingModule {}
