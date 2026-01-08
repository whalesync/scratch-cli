/**
 * File system entity types for the file-based workbook database
 */

import { Service } from './enums';
import { FileId, FolderId } from './ids';

/**
 * Reference to a file in the workbook
 */
export interface FileRefEntity {
  type: 'file';
  id: FileId;
  name: string;
  /** ID of the parent folder, or null if at workbook root */
  parentFolderId: FolderId | null;
}

/**
 * Reference to a folder in the workbook
 */
export interface FolderRefEntity {
  type: 'folder';
  id: FolderId;
  name: string;
  /** ID of the parent folder, or null if at workbook root */
  parentFolderId: FolderId | null;
  /** Service type if folder is linked to a snapshot table */
  connectorService?: Service | null;
}

/**
 * Either a file or folder reference
 */
export type FileOrFolderRefEntity = FileRefEntity | FolderRefEntity;

export interface FileDetailsEntity {
  ref: FileRefEntity;
  content: string | null;
  originalContent: string | null;
  suggestedContent: string | null;
  createdAt: string; // ISO-8601 string
  updatedAt: string; // ISO-8601 string
}
