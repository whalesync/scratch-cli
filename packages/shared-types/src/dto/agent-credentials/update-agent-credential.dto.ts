import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateAgentCredentialDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  tokenUsageWarningLimit?: number;

  @IsBoolean()
  @IsOptional()
  default?: boolean;
}

export type ValidatedUpdateAgentCredentialDto = UpdateAgentCredentialDto;
