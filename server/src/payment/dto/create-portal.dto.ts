import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ScratchpadPlanType } from '../plans';

export class CreatePortalDto {
  @IsString()
  @IsOptional()
  portalType?: 'cancel_subscription' | 'update_subscription' | 'manage_payment_methods';

  @IsString()
  @IsOptional()
  returnPath?: string;

  @IsEnum(ScratchpadPlanType)
  @IsOptional()
  planType?: ScratchpadPlanType;
}
