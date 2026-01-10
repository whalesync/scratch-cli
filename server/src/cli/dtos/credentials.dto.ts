import { AuthType, Service } from '@spinner/shared-types';
import { IsEnum, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

/**
 * A common object containing the connector credentials for all
 * CLI requests that talk with data sources
 */
export class ConnectorCredentialsDto {
  @IsEnum(Service)
  @IsNotEmpty()
  readonly service?: Service;

  @IsObject()
  @IsOptional()
  readonly userProvidedParams?: Record<string, string>;

  @IsEnum(AuthType)
  @IsOptional()
  readonly authType?: AuthType;
}

export type ValidatedConnectorCredentialsDto = Required<Pick<ConnectorCredentialsDto, 'service'>> &
  Pick<ConnectorCredentialsDto, 'userProvidedParams' | 'authType'>;
