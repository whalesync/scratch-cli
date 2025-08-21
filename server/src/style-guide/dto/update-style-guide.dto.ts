import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateStyleGuideDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsBoolean()
  @IsOptional()
  autoInclude?: boolean;

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
