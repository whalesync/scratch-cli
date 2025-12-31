/**
 * File system entity types for the file-based workbook database
 */

import { FileId } from './ids';

export interface FileRefEntity {
  type: 'file' | 'folder';
  id: FileId;
  path: string;
  name: string;
  parentPath: string;
}

export interface FileDetailsEntity {
  ref: FileRefEntity & { type: 'file' };
  content: string | null;
}
