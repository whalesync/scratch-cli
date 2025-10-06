import { AuthType, Service } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateConnectorAccountDto {
  @IsEnum(Service)
  @IsNotEmpty()
  readonly service: Service;

  @IsString()
  @IsNotEmpty()
  readonly apiKey: string;

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
