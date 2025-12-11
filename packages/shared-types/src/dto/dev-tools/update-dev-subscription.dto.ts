import { IsEnum } from 'class-validator';
import { ScratchPlanType } from '../../subscription';
export class UpdateDevSubscriptionDto {
  @IsEnum(ScratchPlanType)
  planType?: ScratchPlanType;
}
