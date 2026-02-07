import { IsArray, IsOptional, IsString } from 'class-validator';

export class PullFilesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dataFolderIds?: string[];
}

export type ValidatedPullFilesDto = PullFilesDto;
