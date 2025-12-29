import { IsString } from 'class-validator';

export class SetContentColumnDto {
  @IsString()
  columnId?: string;
}

export type ValidatedSetContentColumnDto = Required<SetContentColumnDto>;
