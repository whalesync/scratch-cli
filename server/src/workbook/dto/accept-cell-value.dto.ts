import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export class AcceptCellValueItem {
  @IsString()
  @IsNotEmpty()
  wsId?: string;

  @IsString()
  @IsNotEmpty()
  columnId?: string;
}

export class AcceptCellValueDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcceptCellValueItem)
  items?: AcceptCellValueItem[];
}

export type ValidatedAcceptCellValueItem = Required<AcceptCellValueItem>;
export type ValidatedAcceptCellValueDto = Required<AcceptCellValueDto>;
