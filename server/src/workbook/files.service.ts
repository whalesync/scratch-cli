import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  FileId,
  FileOrFolderRefEntity,
  FileRefEntity,
  FolderId,
  FolderRefEntity,
  WorkbookId,
} from '@spinner/shared-types';
import {
  createFolderId,
  FileDetailsResponseDto,
  FolderResponseDto,
  ListFilesDetailsResponseDto,
  ListFilesResponseDto,
  ValidatedCreateFileDto,
  ValidatedCreateFolderDto,
  ValidatedUpdateFileDto,
  ValidatedUpdateFolderDto,
} from '@spinner/shared-types';
import matter from 'gray-matter';
import { DbService } from '../db/db.service';
import { Actor } from '../users/types';
import { WorkbookDbService } from './workbook-db.service';

@Injectable()
export class FilesService {
  constructor(
    private readonly db: DbService,
    private readonly workbookDbService: WorkbookDbService,
  ) {}

  /**
   * Verify that the actor has access to the workbook
   */
  private async verifyWorkbookAccess(workbookId: WorkbookId, actor: Actor): Promise<void> {
    const workbook = await this.db.client.workbook.findFirst({
      where: {
        id: workbookId,
        organizationId: actor.organizationId,
      },
    });

    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }
  }

  /**
   * Lists all files and folders in a workbook
   * Returns a flat list that can be rendered as a tree by the client
   */
  async listFilesAndFolders(workbookId: WorkbookId, actor: Actor): Promise<ListFilesResponseDto> {
    await this.verifyWorkbookAccess(workbookId, actor);

    // Get all folders in the workbook
    const folders = await this.db.client.folder.findMany({
      where: { workbookId },
      orderBy: { name: 'asc' },
    });

    // Get all files in the workbook
    const files = await this.workbookDbService.workbookDb.listAllFiles(workbookId);

    // Convert folders to FolderRefEntity
    const folderEntities: FolderRefEntity[] = folders.map((f) => ({
      type: 'folder' as const,
      id: f.id as FolderId,
      name: f.name,
      parentFolderId: f.parentId as FolderId | null,
    }));

    // Convert files to FileRefEntity
    const fileEntities: FileRefEntity[] = files.map((f) => ({
      type: 'file' as const,
      id: f.id as FileId,
      name: f.name,
      parentFolderId: (f.folder_id || null) as FolderId | null,
    }));

    // Combine and return
    const items: FileOrFolderRefEntity[] = [...folderEntities, ...fileEntities];

    return { items };
  }

  /**
   * Lists all of the files in a folder including full file content.
   */
  async getFilesByFolderId(
    workbookId: WorkbookId,
    folderId: FolderId | null,
    actor: Actor,
  ): Promise<ListFilesDetailsResponseDto> {
    await this.verifyWorkbookAccess(workbookId, actor);

    // Get all files in the workbook
    const files = await this.workbookDbService.workbookDb.listAllFiles(workbookId);

    // Filter by folderId
    const filteredFiles = files.filter((f) => {
      // Handle root folder (null or empty string)
      if (!folderId) {
        return !f.folder_id;
      }
      return f.folder_id === folderId;
    });

    const mappedFiles = filteredFiles.map((f) => ({
      ref: {
        type: 'file' as const,
        id: f.id as FileId,
        name: f.name,
        parentFolderId: f.folder_id as FolderId | null,
      },
      content: f.content,
      originalContent: f.original,
      suggestedContent: f.suggested,
      createdAt: f.created_at.toISOString(),
      updatedAt: f.updated_at.toISOString(),
    }));

    // Sort by name
    mappedFiles.sort((a, b) => a.ref.name.localeCompare(b.ref.name));

    return { files: mappedFiles };
  }

  /**
   * Get a single file by ID
   */
  async getFileById(workbookId: WorkbookId, fileId: FileId, actor: Actor): Promise<FileDetailsResponseDto> {
    await this.verifyWorkbookAccess(workbookId, actor);

    const file = await this.workbookDbService.workbookDb.getFileById(workbookId, fileId);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return {
      file: {
        ref: {
          type: 'file',
          id: file.id as FileId,
          name: file.name,
          parentFolderId: file.folder_id as FolderId | null,
        },
        content: file.content,
        originalContent: file.original,
        suggestedContent: file.suggested,
        createdAt: file.created_at.toISOString(),
        updatedAt: file.updated_at.toISOString(),
      },
    };
  }

  /**
   * Create a new file
   */
  async createFile(
    workbookId: WorkbookId,
    createFileDto: ValidatedCreateFileDto,
    actor: Actor,
  ): Promise<FileRefEntity> {
    await this.verifyWorkbookAccess(workbookId, actor);

    // Verify parent folder exists if specified
    if (createFileDto.parentFolderId) {
      const folder = await this.db.client.folder.findFirst({
        where: {
          id: createFileDto.parentFolderId,
          workbookId,
        },
      });
      if (!folder) {
        throw new NotFoundException('Parent folder not found');
      }
    }

    const fileId = await this.workbookDbService.workbookDb.createFileWithFolderId(
      workbookId,
      createFileDto.name,
      createFileDto.parentFolderId ?? null,
      createFileDto.content ?? null,
    );

    return {
      type: 'file',
      id: fileId,
      name: createFileDto.name,
      parentFolderId: createFileDto.parentFolderId ?? null,
    };
  }

  /**
   * Update an existing file
   */
  async updateFile(
    workbookId: WorkbookId,
    fileId: FileId,
    updateFileDto: ValidatedUpdateFileDto,
    actor: Actor,
  ): Promise<void> {
    await this.verifyWorkbookAccess(workbookId, actor);

    // Verify parent folder exists if being changed
    if (updateFileDto.parentFolderId !== undefined && updateFileDto.parentFolderId !== null) {
      const folder = await this.db.client.folder.findFirst({
        where: {
          id: updateFileDto.parentFolderId,
          workbookId,
        },
      });
      if (!folder) {
        throw new NotFoundException('Parent folder not found');
      }
    }

    await this.workbookDbService.workbookDb.updateFileById(workbookId, fileId, {
      name: updateFileDto.name,
      folderId: updateFileDto.parentFolderId,
      content: updateFileDto.content,
    });
  }

  /**
   * Delete a file (soft delete)
   */
  async deleteFile(workbookId: WorkbookId, fileId: FileId, actor: Actor): Promise<void> {
    await this.verifyWorkbookAccess(workbookId, actor);

    await this.workbookDbService.workbookDb.deleteFileById(workbookId, fileId, false);
  }

  /**
   * Create a new folder
   */
  async createFolder(
    workbookId: WorkbookId,
    createFolderDto: ValidatedCreateFolderDto,
    actor: Actor,
  ): Promise<FolderResponseDto> {
    await this.verifyWorkbookAccess(workbookId, actor);

    // Verify parent folder exists if specified
    if (createFolderDto.parentFolderId) {
      const parentFolder = await this.db.client.folder.findFirst({
        where: {
          id: createFolderDto.parentFolderId,
          workbookId,
        },
      });
      if (!parentFolder) {
        throw new NotFoundException('Parent folder not found');
      }
    }

    // Check for duplicate folder name at same level
    const existingFolder = await this.db.client.folder.findFirst({
      where: {
        workbookId,
        parentId: createFolderDto.parentFolderId ?? null,
        name: createFolderDto.name,
      },
    });
    if (existingFolder) {
      throw new BadRequestException('A folder with this name already exists at this location');
    }

    const folder = await this.db.client.folder.create({
      data: {
        id: createFolderId(),
        name: createFolderDto.name,
        workbookId,
        parentId: createFolderDto.parentFolderId ?? null,
      },
    });

    return {
      folder: {
        id: folder.id as FolderId,
        name: folder.name,
        parentId: folder.parentId as FolderId | null,
      },
    };
  }

  /**
   * Update a folder (rename or move)
   */
  async updateFolder(
    workbookId: WorkbookId,
    folderId: FolderId,
    updateFolderDto: ValidatedUpdateFolderDto,
    actor: Actor,
  ): Promise<FolderResponseDto> {
    await this.verifyWorkbookAccess(workbookId, actor);

    // Verify folder exists
    const folder = await this.db.client.folder.findFirst({
      where: {
        id: folderId,
        workbookId,
      },
    });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    // Verify new parent folder exists if specified
    if (updateFolderDto.parentFolderId !== undefined && updateFolderDto.parentFolderId !== null) {
      // Prevent moving folder into itself or a descendant
      if (updateFolderDto.parentFolderId === folderId) {
        throw new BadRequestException('Cannot move folder into itself');
      }

      const newParent = await this.db.client.folder.findFirst({
        where: {
          id: updateFolderDto.parentFolderId,
          workbookId,
        },
      });
      if (!newParent) {
        throw new NotFoundException('New parent folder not found');
      }

      // Check if new parent is a descendant of this folder (would create a cycle)
      const isDescendant = await this.isFolderDescendant(workbookId, updateFolderDto.parentFolderId, folderId);
      if (isDescendant) {
        throw new BadRequestException('Cannot move folder into its own descendant');
      }
    }

    // Check for duplicate folder name at new level (if name or parent changed)
    const newName = updateFolderDto.name ?? folder.name;
    const newParentId = updateFolderDto.parentFolderId !== undefined ? updateFolderDto.parentFolderId : folder.parentId;

    if (newName !== folder.name || newParentId !== folder.parentId) {
      const existingFolder = await this.db.client.folder.findFirst({
        where: {
          workbookId,
          parentId: newParentId,
          name: newName,
          NOT: { id: folderId },
        },
      });
      if (existingFolder) {
        throw new BadRequestException('A folder with this name already exists at this location');
      }
    }

    const updatedFolder = await this.db.client.folder.update({
      where: { id: folderId },
      data: {
        name: updateFolderDto.name ?? undefined,
        parentId: updateFolderDto.parentFolderId !== undefined ? updateFolderDto.parentFolderId : undefined,
      },
    });

    return {
      folder: {
        id: updatedFolder.id as FolderId,
        name: updatedFolder.name,
        parentId: updatedFolder.parentId as FolderId | null,
      },
    };
  }

  /**
   * Delete a folder (and optionally its contents)
   */
  async deleteFolder(workbookId: WorkbookId, folderId: FolderId, actor: Actor): Promise<void> {
    await this.verifyWorkbookAccess(workbookId, actor);

    // Verify folder exists
    const folder = await this.db.client.folder.findFirst({
      where: {
        id: folderId,
        workbookId,
      },
    });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    // Delete folder (cascade will handle children due to schema relation)
    await this.db.client.folder.delete({
      where: { id: folderId },
    });
  }

  /**
   * Check if a folder is a descendant of another folder
   */
  private async isFolderDescendant(
    workbookId: WorkbookId,
    potentialDescendantId: FolderId,
    ancestorId: FolderId,
  ): Promise<boolean> {
    let currentId: FolderId | null = potentialDescendantId;

    while (currentId) {
      const folder = await this.db.client.folder.findFirst({
        where: { id: currentId, workbookId },
        select: { parentId: true },
      });

      if (!folder) return false;
      if (folder.parentId === ancestorId) return true;
      currentId = folder.parentId as FolderId | null;
    }

    return false;
  }

  /**
   * Download a file as markdown with front matter (public, no auth required)
   * Security relies on workbook IDs being unguessable
   */
  async downloadFileAsMarkdownPublic(workbookId: WorkbookId, filePath: string): Promise<string> {
    const file = await this.workbookDbService.workbookDb.getFileByPath(workbookId, filePath);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // If there's no content, return empty string
    if (!file.content) {
      return '';
    }

    // If there's metadata, reconstruct the markdown with YAML front matter
    if (file.metadata && Object.keys(file.metadata).length > 0) {
      return matter.stringify(file.content, file.metadata);
    }

    // Otherwise, just return the content
    return file.content;
  }
}
