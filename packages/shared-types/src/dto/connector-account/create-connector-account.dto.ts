import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { AuthType, Service } from '../../enums';

export class CreateConnectorAccountDto {
  @IsEnum(Service)
  @IsNotEmpty()
  readonly service?: Service;

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

export type ValidatedCreateConnectorAccountDto = Required<Pick<CreateConnectorAccountDto, 'service'>> &
  Pick<CreateConnectorAccountDto, 'userProvidedParams' | 'authType' | 'modifier' | 'displayName'>;
