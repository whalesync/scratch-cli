import { Service } from '@spinner/shared-types';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { TablePreview } from 'src/remote-service/connectors/types';
import { ConnectorCredentialsDto } from './credentials.dto';

export class ListTablesDto {
  @ValidateNested()
  @Type(() => ConnectorCredentialsDto)
  @IsNotEmpty()
  readonly credentials?: ConnectorCredentialsDto;
}

export class ListTablesResponseDto {
  readonly service?: Service;
  readonly success?: boolean;
  readonly error?: string;
  readonly tables?: TablePreview[];
}
