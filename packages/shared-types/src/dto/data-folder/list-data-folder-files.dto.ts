import type { FileId } from '../../ids';

export interface DataFolderFileRef {
  fileId: FileId;
  filename: string;
  path: string;
}

export interface ListDataFolderFilesResponseDto {
  files: DataFolderFileRef[];
}
