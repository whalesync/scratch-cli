import { IsArray, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class DownloadRequestDto {
  // The ID of the table to download, can be an array of IDs if the table is nested in a base or site
  // actual meaning depends on the connector
  @IsString({ each: true })
  @IsArray()
  tableId?: string[];

  @IsString()
  filenameFieldId?: string;

  @IsString()
  contentFieldId?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  offset?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(1000)
  limit?: number;
}

export type ValidatedDownloadRequestDto = Required<Pick<DownloadRequestDto, 'tableId'>>;

export type FileContent = {
  // A file name slug, should be URL-friendly and unique
  slug: string;

  // The remote ID of remote record that this file was generated from
  id: string;

  // the content of the file in Frontmatter YAML format
  content: string;
};

export class DownloadedFilesResponseDto {
  readonly error?: string;
  readonly files?: FileContent[];
}
