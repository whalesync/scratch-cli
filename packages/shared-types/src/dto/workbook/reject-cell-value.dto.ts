import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export class RejectCellValueItem {
  @IsString()
  @IsNotEmpty()
  wsId?: string;

  @IsString()
  @IsNotEmpty()
  columnId?: string;
}

export class RejectCellValueDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RejectCellValueItem)
  items?: RejectCellValueItem[];
}

export type ValidatedRejectCellValueItem = Required<RejectCellValueItem>;
export type ValidatedRejectCellValueDto = Required<RejectCellValueDto>;
