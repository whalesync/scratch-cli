import { filesApi, foldersApi } from '@/lib/api/files';
import { FolderId, WorkbookId } from '@spinner/shared-types';

export interface PendingUploadFile {
  type: 'file';
  name: string;
  content: string;
}

export interface PendingUploadFolder {
  type: 'folder';
  name: string;
  children: (PendingUploadFile | PendingUploadFolder)[];
}

export type PendingUploadItem = PendingUploadFile | PendingUploadFolder;

// Types for File System Access API (webkitGetAsEntry)
interface FileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
}

interface FileSystemFileEntry extends FileSystemEntry {
  file: (successCallback: (file: File) => void, errorCallback?: (error: Error) => void) => void;
}

interface FileSystemDirectoryEntry extends FileSystemEntry {
  createReader: () => FileSystemDirectoryReader;
}

interface FileSystemDirectoryReader {
  readEntries: (successCallback: (entries: FileSystemEntry[]) => void, errorCallback?: (error: Error) => void) => void;
}

/**
 * Scans DataTransferItems to reconstruct directory structure
 */
export async function scanDataTransferItems(items: DataTransferItemList): Promise<PendingUploadItem[]> {
  const pendingItems: PendingUploadItem[] = [];
  const entries: FileSystemEntry[] = [];

  // 1. Extract entries from DataTransferItemList
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        entries.push(entry as FileSystemEntry);
      }
    }
  }

  // 2. Traverse each entry
  for (const entry of entries) {
    const result = await traverseEntry(entry);
    if (result) {
      pendingItems.push(result);
    }
  }

  return pendingItems;
}

async function traverseEntry(entry: FileSystemEntry): Promise<PendingUploadItem | null> {
  if (entry.isFile) {
    return processFileEntry(entry as FileSystemFileEntry);
  } else if (entry.isDirectory) {
    return processDirectoryEntry(entry as FileSystemDirectoryEntry);
  }
  return null;
}

async function processFileEntry(entry: FileSystemFileEntry): Promise<PendingUploadFile | null> {
  // Filter for supported files (Markdown and CSV)
  if (!entry.name.endsWith('.md') && !entry.name.endsWith('.csv')) {
    return null;
  }

  try {
    const file = await new Promise<File>((resolve, reject) => {
      entry.file(resolve, reject);
    });
    const content = await file.text();
    return {
      type: 'file',
      name: entry.name,
      content,
    };
  } catch (error) {
    console.warn(`Failed to read file ${entry.name}`, error);
    return null;
  }
}

async function processDirectoryEntry(entry: FileSystemDirectoryEntry): Promise<PendingUploadFolder | null> {
  const children: (PendingUploadFile | PendingUploadFolder)[] = [];
  const dirEntries = await readAllDirectoryEntries(entry.createReader());

  for (const childEntry of dirEntries) {
    const result = await traverseEntry(childEntry);
    if (result) {
      children.push(result);
    }
  }

  // If a folder ends up empty (e.g. contained only non-md files), we still include it?
  // The requirement says "upload a folder of md files... If it contains 0 md files - error".
  // This likely applies to the *entire* upload operation.
  // Individual empty subfolders should probably be kept if the parent operation is valid,
  // or filtered out if we only want folders that contain MD files.
  // For now, we'll keep the structure, assuming validation happens at the top level.

  return {
    type: 'folder',
    name: entry.name,
    children,
  };
}

async function readAllDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];
  let reading = true;

  while (reading) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });

    if (batch.length > 0) {
      entries.push(...batch);
    } else {
      reading = false;
    }
  }

  return entries;
}

/**
 * Counts the total number of supported files (markdown and CSV) in the pending structure
 */
export function countSupportedFiles(items: PendingUploadItem[]): number {
  let count = 0;
  for (const item of items) {
    if (item.type === 'file') {
      count++;
    } else {
      count += countSupportedFiles(item.children);
    }
  }
  return count;
}

/**
 * Uploads the scanned structure to the server
 */
export async function uploadStructure(
  workbookId: WorkbookId,
  items: PendingUploadItem[],
  parentId: FolderId | null,
): Promise<void> {
  // Process items sequentially to maintain some order and not overwhelm the server
  for (const item of items) {
    if (item.type === 'file') {
      await filesApi.createFile(workbookId, {
        name: item.name,
        parentFolderId: parentId,
        content: item.content,
      });
    } else {
      // Create folder
      // Cast to strict type to prevent lint errors and handle the { folder: ... } wrapper
      const response = (await foldersApi.createFolder(workbookId, {
        name: item.name,
        parentFolderId: parentId,
      })) as unknown as { folder: { id: FolderId } };

      // Upload children into the new folder
      await uploadStructure(workbookId, item.children, response.folder.id);
    }
  }
}
