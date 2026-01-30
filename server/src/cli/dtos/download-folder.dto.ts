import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class FolderFileContentDto {
  @IsString()
  @IsOptional()
  fileId?: string; // FileId is a branded string type

  @IsString()
  @IsOptional()
  remoteId?: string | null;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  path?: string;

  @IsString()
  @IsOptional()
  content?: string | null;

  @IsString()
  @IsOptional()
  original?: string | null;

  @IsBoolean()
  @IsOptional()
  deleted?: boolean;

  @IsBoolean()
  @IsOptional()
  dirty?: boolean;
}

export type ValidatedFolderFileContentDto = Required<
  Pick<FolderFileContentDto, 'fileId' | 'name' | 'path' | 'deleted' | 'dirty'>
> &
  Pick<FolderFileContentDto, 'remoteId' | 'content' | 'original'>;

export class FolderMetadataDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  workbookId?: string;

  @IsString()
  @IsOptional()
  connectorService?: string | null;

  @IsString()
  @IsOptional()
  connectorDisplayName?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tableId?: string[];

  @IsString()
  @IsOptional()
  path?: string | null;

  @IsObject()
  @IsOptional()
  schema?: Record<string, unknown> | null;

  @IsString()
  @IsOptional()
  lastSyncTime?: string | null;
}

export type ValidatedFolderMetadataDto = Required<Pick<FolderMetadataDto, 'id' | 'name' | 'workbookId'>> &
  Pick<FolderMetadataDto, 'connectorService' | 'connectorDisplayName' | 'tableId' | 'path' | 'schema' | 'lastSyncTime'>;

export class DownloadFolderResponseDto {
  @IsString()
  @IsOptional()
  error?: string;

  @ValidateNested()
  @Type(() => FolderMetadataDto)
  @IsOptional()
  folder?: FolderMetadataDto;

  @ValidateNested({ each: true })
  @Type(() => FolderFileContentDto)
  @IsArray()
  @IsOptional()
  files?: FolderFileContentDto[];

  @IsNumber()
  @IsOptional()
  totalCount?: number;
}
