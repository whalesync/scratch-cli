import { Service } from '@spinner/shared-types';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';
import { ConnectorCredentialsDto } from './credentials.dto';

export class ListTableSpecsDto {
  @ValidateNested()
  @Type(() => ConnectorCredentialsDto)
  @IsNotEmpty()
  readonly credentials?: ConnectorCredentialsDto;
}

export class ListTableSpecsResponseDto {
  readonly service?: Service;
  readonly success?: boolean;
  readonly error?: string;
  readonly tables?: AnyTableSpec[];
}
