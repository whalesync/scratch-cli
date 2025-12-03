import { IsOptional, IsString } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsString()
  @IsOptional()
  returnPath?: string;
}
