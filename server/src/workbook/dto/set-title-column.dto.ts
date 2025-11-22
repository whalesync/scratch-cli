import { IsString } from 'class-validator';

export class SetTitleColumnDto {
  @IsString()
  columnId?: string;
}

export type ValidatedSetTitleColumnDto = Required<SetTitleColumnDto>;
