/**
 * File system entity types for the file-based workbook database
 */

import { FileId } from './ids';

export interface FileRefEntity {
  type: 'file';
  id: FileId;
  path: string;
  name: string;
}

export interface FileDetailsEntity {
  ref: FileRefEntity;
  content: string | null;
}

export interface FolderRefEntity {
  type: 'folder';
  // id??
  path: string;
  name: string;
  children: (FileRefEntity | FolderRefEntity)[];
  // TODO: Add pagination token to the folder to get more children.
}
