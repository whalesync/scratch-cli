import { IsArray, IsOptional, IsString } from 'class-validator';

export class PullFilesDto {
  /** @deprecated Use dataFolderIds instead */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  snapshotTableIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dataFolderIds?: string[];
}

export type ValidatedPullFilesDto = PullFilesDto;
