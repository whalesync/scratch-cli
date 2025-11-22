import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateConnectorAccountDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  readonly displayName?: string;

  @IsObject()
  @IsOptional()
  readonly userProvidedParams?: Record<string, string>;

  @IsString()
  @IsOptional()
  readonly modifier?: string;

  @IsObject()
  @IsOptional()
  readonly extras?: Record<string, any>;
}

export type ValidatedUpdateConnectorAccountDto = UpdateConnectorAccountDto;
