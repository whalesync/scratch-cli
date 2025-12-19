import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { OpenRouterModel } from '@spinner/shared-types';
import { OpenRouterService } from '../openrouter/openrouter.service';

@Injectable()
export class AgentPricingService {
  constructor(private readonly openRouterService: OpenRouterService) {}

  async getModels(): Promise<OpenRouterModel[]> {
    const result = await this.openRouterService.getModels();

    if (result.r === 'error') {
      throw new InternalServerErrorException(result.error);
    }

    return result.v;
  }
}
