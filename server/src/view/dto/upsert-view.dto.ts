import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
import { ViewConfig } from '../types';

export class UpsertViewDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  snapshotId: string;

  @IsObject()
  config: ViewConfig;

  @IsOptional()
  @IsBoolean()
  save?: boolean;
}
