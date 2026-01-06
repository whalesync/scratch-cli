import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { FileDetailsEntity } from '../../file-types';
import { FolderId } from '../../ids';

export interface FileDetailsResponseDto {
  file: FileDetailsEntity;
}

export type ValidatedFileDetailsResponseDto = Required<FileDetailsResponseDto>;

export class CreateFileDto {
  /** Name of the file (with extension) */
  @IsString()
  @IsNotEmpty()
  name?: string;

  /** ID of the parent folder, or null for workbook root */
  @IsString()
  @IsOptional()
  parentFolderId?: FolderId | null;

  @IsString()
  @IsOptional()
  content?: string | null;
}

export type ValidatedCreateFileDto = Required<Pick<CreateFileDto, 'name'>> &
  Pick<CreateFileDto, 'parentFolderId' | 'content'>;

export class UpdateFileDto {
  /** New name for the file (with extension) */
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  /** New parent folder ID, or null to move to workbook root */
  @IsString()
  @IsOptional()
  parentFolderId?: FolderId | null;

  @IsString()
  @IsOptional()
  content?: string | null;
}

export type ValidatedUpdateFileDto = UpdateFileDto;
