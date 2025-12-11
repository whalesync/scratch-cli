import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { PostgresColumnType } from '../../connector-types';

export class AddScratchColumnDto {
  @IsString()
  @IsNotEmpty()
  columnName?: string;

  @IsEnum(PostgresColumnType)
  dataType?: PostgresColumnType;
}

export class RemoveScratchColumnDto {
  @IsString()
  @IsNotEmpty()
  columnId?: string;
}

export type ValidatedAddScratchColumnDto = Required<AddScratchColumnDto>;
export type ValidatedRemoveScratchColumnDto = Required<RemoveScratchColumnDto>;
