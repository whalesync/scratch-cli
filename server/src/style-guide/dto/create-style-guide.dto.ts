import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStyleGuideDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  body: string;

  @IsBoolean()
  autoInclude: boolean;

  @IsString()
  @IsOptional()
  sourceUrl: string;

  @IsString()
  @IsOptional()
  @IsIn(['markdown', 'json', 'text'])
  contentType: string;

  @IsArray()
  @IsOptional()
  tags: string[];
}
