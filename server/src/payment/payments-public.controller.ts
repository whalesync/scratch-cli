import { ClassSerializerInterceptor, Controller, Get, UseInterceptors } from '@nestjs/common';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { SubscriptionPlanEntity } from './entities/subscription-plan';
import { getPlans } from './plans';

@Controller('payment')
@UseInterceptors(ClassSerializerInterceptor)
export class PaymentsPublicController {
  constructor(private readonly configService: ScratchpadConfigService) {}

  /**
   * Called publicly to get a list of available plans.
   */
  @Get('plans')
  listPlans(): SubscriptionPlanEntity[] {
    const plans = getPlans(this.configService.getScratchpadEnvironment());
    return plans.filter((plan) => !plan.hidden).map((plan) => new SubscriptionPlanEntity(plan));
  }
}
