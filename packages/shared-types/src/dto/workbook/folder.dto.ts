import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Folder } from '../../db/folder';
import { FolderId } from '../../ids';

/**
 * DTO for creating a new folder
 */
export class CreateFolderDto {
  @IsString()
  @IsNotEmpty()
  name?: string;

  /** ID of the parent folder, or null/undefined for root level */
  @IsOptional()
  @IsString()
  parentFolderId?: FolderId | null;
}

export type ValidatedCreateFolderDto = Required<Pick<CreateFolderDto, 'name'>> &
  Pick<CreateFolderDto, 'parentFolderId'>;

/**
 * DTO for updating a folder
 */
export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  /** ID of the new parent folder, or null for root level */
  @IsOptional()
  @IsString()
  parentFolderId?: FolderId | null;
}

export type ValidatedUpdateFolderDto = UpdateFolderDto;

/**
 * Response for folder operations
 */
export interface FolderResponseDto {
  folder: Pick<Folder, 'id' | 'name' | 'parentId'>;
}

/**
 * Response for listing folders
 */
export interface ListFoldersResponseDto {
  folders: Pick<Folder, 'id' | 'name' | 'parentId'>[];
}
