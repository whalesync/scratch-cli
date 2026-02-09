import { ClassSerializerInterceptor, Controller, Get, UseInterceptors } from '@nestjs/common';
import { ScratchConfigService } from 'src/config/scratch-config.service';
import { SubscriptionPlanEntity } from './entities/subscription-plan';
import { getPlans } from './plans';

@Controller('payment')
@UseInterceptors(ClassSerializerInterceptor)
export class PaymentsPublicController {
  constructor(private readonly configService: ScratchConfigService) {}

  /**
   * Called publicly to get a list of available plans.
   */
  @Get('plans')
  listPlans(): SubscriptionPlanEntity[] {
    const plans = getPlans(this.configService.getScratchEnvironment());
    return plans.filter((plan) => !plan.hidden).map((plan) => new SubscriptionPlanEntity(plan));
  }
}
