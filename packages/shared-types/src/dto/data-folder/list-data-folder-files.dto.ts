import type { FileId } from '../../ids';

export interface DataFolderFileRef {
  fileId: FileId;
  filename: string;
  path: string;
  deleted: boolean;
}

export interface ListDataFolderFilesResponseDto {
  files: DataFolderFileRef[];
  totalCount: number;
}
