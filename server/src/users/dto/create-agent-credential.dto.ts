import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateAgentCredentialDto {
  @IsString()
  service: string;

  @IsString()
  apiKey: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  enabled: boolean;
}

export class UpdateAgentCredentialDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
