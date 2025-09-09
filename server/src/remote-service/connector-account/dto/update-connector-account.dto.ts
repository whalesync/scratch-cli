import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateConnectorAccountDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  readonly displayName?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  readonly apiKey?: string;

  @IsString()
  @IsOptional()
  readonly modifier?: string;

  @IsObject()
  @IsOptional()
  readonly extras?: Record<string, any>;
}
