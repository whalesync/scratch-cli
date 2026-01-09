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
  /** Full path of the file, e.g. "/folder/file.md" */
  path: string;
  /** Whether the file has unpublished changes */
  dirty?: boolean;
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
  /** Full path of the folder, e.g. "/parent/child" */
  path: string;
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
