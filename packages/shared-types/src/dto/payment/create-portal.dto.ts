import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ScratchPlanType } from '../../subscription';

export class CreatePortalDto {
  @IsString()
  @IsOptional()
  portalType?: 'cancel_subscription' | 'update_subscription' | 'manage_payment_methods';

  @IsString()
  @IsOptional()
  returnPath?: string;

  @IsEnum(ScratchPlanType)
  @IsOptional()
  planType?: ScratchPlanType;
}

export type CreateCustomerPortalUrlResponse = {
  url: string;
};
