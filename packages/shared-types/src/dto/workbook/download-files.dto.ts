import { IsArray, IsOptional, IsString } from 'class-validator';

export class DownloadFilesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  snapshotTableIds?: string[];
}

export type ValidatedDownloadFilesDto = DownloadFilesDto;
