import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAgentCredentialDto {
  @IsString()
  service?: string;

  @IsString()
  apiKey?: string;

  @IsString()
  name?: string;

  @IsNumber()
  @IsOptional()
  tokenUsageWarningLimit?: number;

  @IsBoolean()
  @IsOptional()
  default?: boolean;
}

export type ValidatedCreateAgentCredentialDto = Required<
  Pick<CreateAgentCredentialDto, 'service' | 'apiKey' | 'name'>
> &
  Pick<CreateAgentCredentialDto, 'tokenUsageWarningLimit' | 'default'>;
