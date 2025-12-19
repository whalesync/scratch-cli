import { Controller, Get, UseGuards } from '@nestjs/common';
import { OpenRouterModel } from '@spinner/shared-types';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { AgentPricingService } from './agent-pricing.service';

@Controller('agent-pricing')
@UseGuards(ScratchpadAuthGuard)
export class AgentPricingController {
  constructor(private readonly agentPricingService: AgentPricingService) {}

  @Get('list')
  async getModels(): Promise<OpenRouterModel[]> {
    return this.agentPricingService.getModels();
  }
}
