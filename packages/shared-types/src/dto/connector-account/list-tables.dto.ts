import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Service } from '../../enums';

export class ListTablesDto {
  @IsEnum(Service)
  service?: Service;

  @IsOptional()
  @IsString()
  connectorAccountId?: string | null;
}

export type ValidatedListTablesDto = Required<Pick<ListTablesDto, 'service'>> &
  Pick<ListTablesDto, 'connectorAccountId'>;
