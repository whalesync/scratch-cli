import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCsvFileDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  body: string;
}
