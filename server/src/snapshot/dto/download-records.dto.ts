import { IsArray, IsOptional, IsString } from 'class-validator';

export class DownloadRecordsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  snapshotTableIds?: string[];
}
