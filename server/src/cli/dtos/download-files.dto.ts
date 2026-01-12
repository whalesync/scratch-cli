import { Service } from '@spinner/shared-types';
import { IsArray, IsString } from 'class-validator';

export class DownloadRequestDto {
  @IsArray()
  @IsString({ each: true })
  tableId?: string[];
}

export type ValidatedDownloadRequestDto = Required<Pick<DownloadRequestDto, 'tableId'>>;

export type FileContent = {
  // File name to give the file, should end in .md
  name: string;
  // The remote ID of remote record that this file was generated from
  remoteId: string;
  // the content of the file in Frontmatter YAML format
  content: string;
};

export class DownloadedFilesResponseDto {
  readonly success?: boolean;
  readonly service?: Service;
  readonly error?: string;
  readonly files?: FileContent[];
}
