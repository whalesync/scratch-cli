import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  FileId,
  FileOrFolderRefEntity,
  FileRefEntity,
  FolderId,
  FolderRefEntity,
  Service,
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
import * as archiver from 'archiver';
import matter from 'gray-matter';
import { DbService } from '../db/db.service';
import { Actor } from '../users/types';
import { FolderService } from './folder.service';
import { WorkbookDbService } from './workbook-db.service';

@Injectable()
export class FilesService {
  constructor(
    private readonly db: DbService,
    private readonly workbookDbService: WorkbookDbService,
    private readonly folderService: FolderService,
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

    // Get all folders in the workbook with their linked snapshot tables
    const folders = await this.db.client.folder.findMany({
      where: { workbookId },
      orderBy: { name: 'asc' },
      include: {
        snapshotTables: {
          select: { connectorService: true },
        },
      },
    });

    // Get all files in the workbook
    const files = await this.workbookDbService.workbookDb.listAllFiles(workbookId);

    // Convert folders to FolderRefEntity
    // If folder has exactly one snapshot table, include its service type
    const folderEntities: FolderRefEntity[] = folders.map((f) => ({
      type: 'folder' as const,
      id: f.id as FolderId,
      name: f.name,
      parentFolderId: f.parentId as FolderId | null,
      path: f.path ?? `/${f.name}`,
      connectorService: f.snapshotTables.length === 1 ? (f.snapshotTables[0].connectorService as Service) : null,
    }));

    // Convert files to FileRefEntity
    const fileEntities: FileRefEntity[] = files.map((f) => ({
      type: 'file' as const,
      id: f.id as FileId,
      name: f.name,
      parentFolderId: (f.folder_id || null) as FolderId | null,
      path: f.path,
      dirty: f.dirty,
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
        path: f.path,
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
          path: file.path,
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

    let parentPath = '';
    // Verify parent folder exists if specified
    if (createFileDto.parentFolderId) {
      const folder = await this.db.client.folder.findFirst({
        where: {
          id: createFileDto.parentFolderId,
          workbookId,
        },
        select: { path: true },
      });
      if (!folder) {
        throw new NotFoundException('Parent folder not found');
      }
      parentPath =
        folder.path ?? (await this.folderService.computeFolderPath(workbookId, createFileDto.parentFolderId));
    }

    const fullPath = (parentPath === '/' ? '' : parentPath) + '/' + createFileDto.name;

    const fileId = await this.workbookDbService.workbookDb.createFileWithFolderId(
      workbookId,
      createFileDto.name,
      createFileDto.parentFolderId ?? null,
      fullPath,
      createFileDto.content ?? null,
    );

    return {
      type: 'file',
      id: fileId,
      name: createFileDto.name,
      parentFolderId: createFileDto.parentFolderId ?? null,
      path: fullPath,
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

    let newPath: string | undefined;

    // If we are renaming or moving, we likely need to recompute the path
    if (updateFileDto.name || updateFileDto.parentFolderId !== undefined) {
      // 1. Fetch current file to know what's missing (e.g. current name if only moving, current folder if only renaming)
      const currentFile = await this.workbookDbService.workbookDb.getFileById(workbookId, fileId);
      if (!currentFile) {
        throw new NotFoundException('File not found');
      }

      const effectiveName = updateFileDto.name ?? currentFile.name;
      const effectiveFolderId =
        updateFileDto.parentFolderId !== undefined ? updateFileDto.parentFolderId : currentFile.folder_id;

      // 2. Fetch parent folder path
      let parentPath = '';
      if (effectiveFolderId) {
        const folder = await this.db.client.folder.findFirst({
          where: { id: effectiveFolderId, workbookId },
          select: { path: true },
        });

        if (!folder) {
          throw new NotFoundException('Parent folder not found');
        }
        parentPath =
          folder.path ?? (await this.folderService.computeFolderPath(workbookId, effectiveFolderId as FolderId));
      }

      newPath = (parentPath === '/' ? '' : parentPath) + '/' + effectiveName;
    }

    await this.workbookDbService.workbookDb.updateFileById(workbookId, fileId, {
      name: updateFileDto.name,
      folderId: updateFileDto.parentFolderId,
      content: updateFileDto.content,
      path: newPath,
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
   * Check if a folder is linked to a snapshot table
   */
  private async isFolderLinked(folderId: FolderId): Promise<boolean> {
    const count = await this.db.client.snapshotTable.count({
      where: { folderId },
    });
    return count > 0;
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

      // Check if parent folder is linked to a snapshot table
      if (await this.isFolderLinked(createFolderDto.parentFolderId)) {
        throw new BadRequestException('Cannot create subfolders in a folder linked to a connector');
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

    let parentPath = '';
    if (createFolderDto.parentFolderId) {
      const parent = await this.db.client.folder.findFirst({
        where: { id: createFolderDto.parentFolderId, workbookId },
        select: { path: true },
      });
      // If parent path isn't populated for some reason, compute it
      parentPath =
        parent?.path ?? (await this.folderService.computeFolderPath(workbookId, createFolderDto.parentFolderId));
    }

    const fullPath = (parentPath === '/' ? '' : parentPath) + '/' + createFolderDto.name;

    const folder = await this.db.client.folder.create({
      data: {
        id: createFolderId(),
        name: createFolderDto.name,
        workbookId,
        parentId: createFolderDto.parentFolderId ?? null,
        path: fullPath,
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

      // Check if new parent folder is linked to a snapshot table
      if (await this.isFolderLinked(updateFolderDto.parentFolderId)) {
        throw new BadRequestException('Cannot move folders into a folder linked to a connector');
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

    // Update paths recursively for the moved folder
    await this.folderService.updateFolderPathRecursive(workbookId, folderId);

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
  async downloadFileAsMarkdownPublic(
    workbookId: WorkbookId,
    fileId: FileId,
  ): Promise<{ content: string; name: string }> {
    const file = await this.workbookDbService.workbookDb.getFileById(workbookId, fileId);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    let content = file.content || '';

    if (file.metadata && Object.keys(file.metadata).length > 0) {
      content = matter.stringify(content, file.metadata);
    }

    return { content, name: file.name };
  }

  /**
   * Download a folder as a zip file (public, no auth required)
   */
  async downloadFolderAsZipPublic(
    workbookId: WorkbookId,
    folderId: FolderId,
  ): Promise<{ stream: NodeJS.ReadableStream; name: string }> {
    const folder = await this.db.client.folder.findFirst({
      where: {
        id: folderId,
        workbookId,
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const folderPath = folder.path ?? (await this.folderService.computeFolderPath(workbookId, folderId));
    // Get all files that start with this path
    const files = await this.workbookDbService.workbookDb.listFilesAndFolders(workbookId, folderPath);

    const archive = archiver.create('zip', {
      zlib: { level: 9 }, // Sets the compression level.
    });

    for (const file of files) {
      // Reconstruct content with frontmatter
      let content = file.content || '';
      if (file.metadata && Object.keys(file.metadata).length > 0) {
        content = matter.stringify(content, file.metadata);
      }

      // Calculate relative path
      // e.g. folderPath = '/foo', file.path = '/foo/bar.md' -> 'bar.md'
      let relativePath = file.path.slice(folderPath.length);
      if (relativePath.startsWith('/')) {
        relativePath = relativePath.slice(1);
      }

      archive.append(content, { name: relativePath });
    }

    void archive.finalize();

    return { stream: archive, name: folder.name };
  }

  /**
   * Copy a file to a target folder
   */
  async copyFile(
    workbookId: WorkbookId,
    fileId: FileId,
    targetFolderId: FolderId | null,
    actor: Actor,
  ): Promise<FileRefEntity> {
    await this.verifyWorkbookAccess(workbookId, actor);

    // Get the source file
    const sourceFile = await this.workbookDbService.workbookDb.getFileById(workbookId, fileId);
    if (!sourceFile) {
      throw new NotFoundException('Source file not found');
    }

    // Verify target folder exists if specified
    let targetPath = '';
    if (targetFolderId) {
      const folder = await this.db.client.folder.findFirst({
        where: {
          id: targetFolderId,
          workbookId,
        },
        select: { path: true },
      });
      if (!folder) {
        throw new NotFoundException('Target folder not found');
      }
      targetPath = folder.path ?? (await this.folderService.computeFolderPath(workbookId, targetFolderId));
    }

    // Generate new file name (append "copy" if in same folder)
    let newFileName = sourceFile.name;
    if ((sourceFile.folder_id || null) === targetFolderId) {
      // Same folder, add "copy" suffix
      const ext = newFileName.lastIndexOf('.');
      if (ext > 0) {
        newFileName = newFileName.slice(0, ext) + ' copy' + newFileName.slice(ext);
      } else {
        newFileName = newFileName + ' copy';
      }
    }

    const fullPath = (targetPath === '/' ? '' : targetPath) + '/' + newFileName;

    // Create the new file with the same content
    const newFileId = await this.workbookDbService.workbookDb.createFileWithFolderId(
      workbookId,
      newFileName,
      targetFolderId,
      fullPath,
      sourceFile.content,
    );

    return {
      type: 'file',
      id: newFileId,
      name: newFileName,
      parentFolderId: targetFolderId,
      path: fullPath,
    };
  }
}
