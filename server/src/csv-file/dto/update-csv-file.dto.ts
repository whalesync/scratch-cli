import { IsOptional, IsString } from 'class-validator';

export class UpdateCsvFileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  body?: string;
}
