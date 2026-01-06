import { IsOptional, IsString } from 'class-validator';
import { FileDetailsEntity, FileOrFolderRefEntity } from '../../file-types';
import { FolderId } from '../../ids';

export class ListFileDto {
  /** ID of the folder to list contents of. Defaults to workbook root (null). */
  @IsOptional()
  @IsString()
  folderId?: FolderId;
}

export type ValidatedListFileDto = ListFileDto;

export interface ListFilesResponseDto {
  /** Flat list of all files and folders within the workbook. */
  items: FileOrFolderRefEntity[];
}

export type ValidatedListFilesResponseDto = Required<ListFilesResponseDto>;

export interface ListFilesDetailsResponseDto {
  /** Flat list of all files in a folder including full file details. */
  files: FileDetailsEntity[];
}

export type ValidatedListFilesDetailsResponseDto = Required<ListFilesDetailsResponseDto>;
