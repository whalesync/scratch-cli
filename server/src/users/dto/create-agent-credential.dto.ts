import { IsOptional, IsString } from 'class-validator';

export class CreateAgentCredentialDto {
  @IsString()
  service: string;

  @IsString()
  apiKey: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateAgentCredentialDto {
  @IsString()
  id: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
