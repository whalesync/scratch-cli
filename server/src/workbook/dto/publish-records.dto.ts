import { IsArray, IsOptional, IsString } from 'class-validator';

export class PublishRecordsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  snapshotTableIds?: string[];
}
