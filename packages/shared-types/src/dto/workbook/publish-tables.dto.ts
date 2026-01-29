import { IsArray, IsOptional, IsString } from 'class-validator';

export class PublishTablesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  snapshotTableIds?: string[];
}

export type ValidatedPublishTablesDto = PublishTablesDto;
