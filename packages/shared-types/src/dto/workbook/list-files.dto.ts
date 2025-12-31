import { IsOptional } from 'class-validator';
import { FileRefEntity } from '../../file-types';

export class ListFileDto {
  // Defaults to root folder.
  @IsOptional()
  folderPath?: string;
}

export type ValidatedListFileDto = ListFileDto;

export interface ListFilesResponseDto {
  /** Flat list of all files and folders under the root. */
  files: FileRefEntity[];
}

export type ValidatedListFilesResponseDto = Required<ListFilesResponseDto>;
