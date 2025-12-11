import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { EntityId } from '../../connector-types';
import { Service } from '../../enums';

export class AddTableToWorkbookDto {
  @IsNotEmpty()
  @IsEnum(Service)
  service?: Service;

  @IsOptional()
  @IsString()
  connectorAccountId?: string;

  @IsNotEmpty()
  tableId?: EntityId;
}

export type ValidatedAddTableToWorkbookDto = Required<Pick<AddTableToWorkbookDto, 'service' | 'tableId'>> &
  Pick<AddTableToWorkbookDto, 'connectorAccountId'>;
