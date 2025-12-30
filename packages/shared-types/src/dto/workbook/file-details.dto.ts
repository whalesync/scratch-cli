import { IsOptional, IsString } from 'class-validator';
import { FileDetailsEntity } from '../../file-types';

export interface FileDetailsResponseDto {
  file: FileDetailsEntity;
}

export type ValidatedFileDetailsResponseDto = Required<FileDetailsResponseDto>;

export class CreateFileDto {
  @IsString()
  path?: string;

  @IsString()
  @IsOptional()
  content?: string | null;
}

export type ValidatedCreateFileDto = Required<Pick<CreateFileDto, 'path'>> & Omit<CreateFileDto, 'path'>;

export class UpdateFileDto {
  @IsString()
  @IsOptional()
  newPath?: string;

  @IsString()
  @IsOptional()
  content?: string | null;
}

export type ValidatedUpdateFileDto = UpdateFileDto;
