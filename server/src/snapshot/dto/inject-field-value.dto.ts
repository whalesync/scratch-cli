import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InjectFieldValueDto {
  @IsString()
  @IsNotEmpty()
  wsId: string;

  @IsString()
  @IsNotEmpty()
  columnId: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsString()
  @IsOptional()
  targetKey: string = '@@';
}
