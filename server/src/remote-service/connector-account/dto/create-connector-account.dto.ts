import { AuthType, Service } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateConnectorAccountDto {
  @IsEnum(Service)
  @IsNotEmpty()
  readonly service: Service;

  @IsObject()
  @IsOptional()
  readonly userProvidedParams?: Record<string, string>;

  @IsEnum(AuthType)
  @IsOptional()
  readonly authType?: AuthType;

  @IsString()
  @IsOptional()
  readonly modifier?: string;

  @IsString()
  @IsOptional()
  readonly displayName?: string;
}
