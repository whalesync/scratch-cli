import { IsNotEmpty, IsString } from 'class-validator';

export class AppendFieldValueDto {
  @IsString()
  @IsNotEmpty()
  wsId: string;

  @IsString()
  @IsNotEmpty()
  columnId: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}
