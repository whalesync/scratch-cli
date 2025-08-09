import { IsBoolean, IsOptional, IsString } from 'class-validator';

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
}
