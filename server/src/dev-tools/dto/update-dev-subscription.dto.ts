import { ScratchPlanType } from '@spinner/shared-types';
import { IsEnum } from 'class-validator';
export class UpdateDevSubscriptionDto {
  @IsEnum(ScratchPlanType)
  planType?: ScratchPlanType;
}
