import { IsOptional } from 'class-validator';
import { FolderRefEntity } from '../../file-types';

export class ListFileDto {
  // Defaults to root folder.
  @IsOptional()
  folderPath?: string;
}

export type ValidatedListFileDto = ListFileDto;

export interface ListFilesResponseDto {
  root: FolderRefEntity;
}

export type ValidatedListFilesResponseDto = Required<ListFilesResponseDto>;
