import { Service } from '@spinner/shared-types';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { ConnectorCredentialsDto } from './credentials.dto';

export class TestCredentialsDto {
  @ValidateNested()
  @Type(() => ConnectorCredentialsDto)
  @IsNotEmpty()
  readonly credentials?: ConnectorCredentialsDto;
}

export class TestCredentialsResponseDto {
  readonly service?: Service;
  readonly success?: boolean;
  readonly error?: string;
}
