import { Injectable } from '@nestjs/common';
import { FolderId, WorkbookId } from '@spinner/shared-types';
import { DbService } from 'src/db/db.service';
import { WSLogger } from 'src/logger';

@Injectable()
export class FolderService {
  constructor(private readonly db: DbService) {}

  /**
   * Moves a folder to a new parent folder.
   * @param workbookId The workbook ID
   * @param folderId The ID of the folder to move
   * @param newParentId The ID of the new parent folder, or null for root
   */
  async moveFolder(workbookId: WorkbookId, folderId: FolderId, newParentId: FolderId | null): Promise<void> {
    // 1. Validate the folder exists and belongs to the workbook
    const folder = await this.db.client.folder.findFirst({
      where: { id: folderId, workbookId },
    });

    if (!folder) {
      throw new Error(`Folder ${folderId} not found in workbook ${workbookId}`);
    }

    // 2. If newParentId is provided, validate it exists and belongs to the same workbook
    if (newParentId) {
      const parentFolder = await this.db.client.folder.findFirst({
        where: { id: newParentId, workbookId },
      });

      if (!parentFolder) {
        throw new Error(`Parent folder ${newParentId} not found in workbook ${workbookId}`);
      }

      // Basic cycle detection: cannot move a folder into itself
      if (folderId === newParentId) {
        throw new Error('Cannot move a folder into itself');
      }

      // Deep cycle detection: cannot move a folder into its own descendant
      const isDescendant = await this.isFolderDescendant(workbookId, newParentId, folderId);
      if (isDescendant) {
        throw new Error('Cannot move a folder into its own descendant');
      }
    }

    // 4. Check for duplicate folder name in the new location
    // The name remains the same, but the parent changes
    const existingFolder = await this.db.client.folder.findFirst({
      where: {
        workbookId,
        parentId: newParentId,
        name: folder.name,
      },
    });

    if (existingFolder) {
      throw new Error(`A folder with the name "${folder.name}" already exists in the destination folder`);
    }

    // 5. Update the folder's parentId
    await this.db.client.folder.update({
      where: { id: folderId },
      data: { parentId: newParentId },
    });

    // 6. Update paths recursively
    await this.updateFolderPathRecursive(workbookId, folderId);

    WSLogger.info({
      source: 'FolderService',
      message: 'Moved folder',
      workbookId,
      folderId,
      oldParentId: folder.parentId,
      newParentId,
    });
  }

  /**
   * Checks if a folder is a descendant of another folder.
   * @param workbookId The workbook ID
   * @param potentialDescendantId The ID of the folder that might be a descendant
   * @param ancestorId The ID of the folder that might be an ancestor
   */
  private async isFolderDescendant(
    workbookId: WorkbookId,
    potentialDescendantId: FolderId,
    ancestorId: FolderId,
  ): Promise<boolean> {
    let currentId: string | null = potentialDescendantId;

    // Use a safety counter to prevent infinite loops if the DB is already corrupted
    let safetyCounter = 0;
    const MAX_DEPTH = 100;

    while (currentId && safetyCounter < MAX_DEPTH) {
      if (currentId === ancestorId) return true;

      const folder: { parentId: string | null } | null = await this.db.client.folder.findFirst({
        where: { id: currentId, workbookId },
        select: { parentId: true },
      });

      if (!folder) return false;
      currentId = folder.parentId;
      safetyCounter++;
    }

    return false;
  }

  /**
   * Computes the full path of a folder by traversing up the hierarchy.
   */
  async computeFolderPath(workbookId: WorkbookId, folderId: FolderId): Promise<string> {
    let currentId: string | null = folderId;
    const parts: string[] = [];

    // Safety limit
    let depth = 0;
    const MAX_DEPTH = 50;

    while (currentId && depth < MAX_DEPTH) {
      const folder: { name: string; parentId: string | null } | null = await this.db.client.folder.findFirst({
        where: { id: currentId, workbookId },
        select: { name: true, parentId: true },
      });

      if (!folder) {
        // If a parent is missing, we might be at a detached subtree or error.
        // For now, assume it's an error or just stop.
        break;
      }

      // If we found the folder, add its name
      parts.unshift(folder.name);
      currentId = folder.parentId;
      depth++;
    }

    return '/' + parts.join('/');
  }

  /**
   * Recursively updates the cached path for a folder and all its descendants.
   * If parentPath is provided, it is used to construct the path instead of re-computing it.
   */
  async updateFolderPathRecursive(workbookId: WorkbookId, folderId: FolderId, parentPath?: string): Promise<void> {
    let currentPath: string;

    if (parentPath !== undefined) {
      const folder = await this.db.client.folder.findFirst({
        where: { id: folderId, workbookId },
        select: { name: true },
      });
      if (!folder) return;

      const prefix = parentPath === '/' ? '' : parentPath;
      currentPath = `${prefix}/${folder.name}`;
    } else {
      currentPath = await this.computeFolderPath(workbookId, folderId);
    }

    await this.db.client.folder.update({
      where: { id: folderId },
      data: { path: currentPath },
    });

    // Find all children
    const children = await this.db.client.folder.findMany({
      where: { parentId: folderId, workbookId },
      select: { id: true },
    });

    for (const child of children) {
      await this.updateFolderPathRecursive(workbookId, child.id as FolderId, currentPath);
    }
  }
}
