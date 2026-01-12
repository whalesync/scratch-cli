import { Service } from '@spinner/shared-types';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';
import { ConnectorCredentialsDto } from './credentials.dto';

export class FetchTableSpecDto {
  @ValidateNested()
  @Type(() => ConnectorCredentialsDto)
  @IsNotEmpty()
  readonly credentials?: ConnectorCredentialsDto;

  @IsString()
  @IsNotEmpty()
  readonly tableId?: string;
}

export type ValidatedFetchTableSpecDto = Required<Pick<FetchTableSpecDto, 'credentials' | 'tableId'>> &
  FetchTableSpecDto;

export class FetchTableSpecResponseDto {
  readonly service?: Service;
  readonly success?: boolean;
  readonly error?: string;
  readonly tableSpec?: AnyTableSpec;
}
