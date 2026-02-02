import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import type { ValidatedFolderMetadataDto } from './download-folder.dto';
import { FolderMetadataDto } from './download-folder.dto';

/**
 * DTO for a file in get/put folder files operations
 */
export class FolderFileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  hash?: string;
}

export type ValidatedFolderFileDto = Required<Pick<FolderFileDto, 'name' | 'content' | 'hash'>>;

/**
 * DTO for a file being uploaded (no hash required)
 */
export class PutFolderFileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  content?: string;
}

export type ValidatedPutFolderFileDto = Required<Pick<PutFolderFileDto, 'name' | 'content'>>;

/**
 * Request DTO for uploading files to a folder
 */
export class PutFolderFilesRequestDto {
  @ValidateNested({ each: true })
  @Type(() => PutFolderFileDto)
  @IsArray()
  @IsOptional()
  files?: PutFolderFileDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  deletedFiles?: string[];
}

export type ValidatedPutFolderFilesRequestDto = {
  files?: ValidatedPutFolderFileDto[];
  deletedFiles?: string[];
};

/**
 * Response DTO for getting files from a folder
 */
export class GetFolderFilesResponseDto {
  @IsBoolean()
  @IsOptional()
  success?: boolean;

  @ValidateNested()
  @Type(() => FolderMetadataDto)
  @IsOptional()
  folder?: ValidatedFolderMetadataDto;

  @ValidateNested({ each: true })
  @Type(() => FolderFileDto)
  @IsArray()
  @IsOptional()
  files?: FolderFileDto[];

  @IsString()
  @IsOptional()
  error?: string;
}

/**
 * Response DTO for uploading files to a folder
 */
export class PutFolderFilesResponseDto {
  @IsBoolean()
  @IsOptional()
  success?: boolean;

  @IsString()
  @IsOptional()
  syncHash?: string;

  @IsString()
  @IsOptional()
  error?: string;
}
