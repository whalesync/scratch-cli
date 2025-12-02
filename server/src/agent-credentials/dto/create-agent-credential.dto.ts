import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateAgentCredentialDto {
  @IsString()
  service?: string;

  @IsString()
  apiKey?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  default?: boolean;
}

export class UpdateAgentCredentialDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  default?: boolean;
}

export type ValidatedCreateAgentCredentialDto = Required<Pick<CreateAgentCredentialDto, 'service' | 'apiKey'>> &
  Pick<CreateAgentCredentialDto, 'description' | 'default'>;
export type ValidatedUpdateAgentCredentialDto = UpdateAgentCredentialDto;
