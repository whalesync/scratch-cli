import { IsOptional } from 'class-validator';
import { FileDetailsEntity, FileRefEntity } from '../../file-types';

export class ListFileDto {
  // Defaults to root folder.
  @IsOptional()
  folderPath?: string;
}

export type ValidatedListFileDto = ListFileDto;

export interface ListFilesResponseDto {
  /** Flat list of all files and folders . */
  files: FileRefEntity[];
}

export type ValidatedListFilesResponseDto = Required<ListFilesResponseDto>;

export interface ListFilesDetailsResponseDto {
  /** Flat list of all files in a folder including full file details. */
  files: FileDetailsEntity[];
}

export type ValidatedListFilesDetailsResponseDto = Required<ListFilesDetailsResponseDto>;
