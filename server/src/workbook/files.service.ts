import { Injectable, NotFoundException } from '@nestjs/common';
import type { FileId, FileRefEntity, ListFilesDetailsResponseDto, WorkbookId } from '@spinner/shared-types';
import {
  FileDetailsResponseDto,
  ListFilesResponseDto,
  ValidatedCreateFileDto,
  ValidatedUpdateFileDto,
} from '@spinner/shared-types';
import path from 'path';
import { DbService } from '../db/db.service';
import { Actor } from '../users/types';
import { extractFolderId, extractFolderPath } from './workbook-db';
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
   * Lists files and folders in tree structure for file browser UI
   */
  async listFilesAndFolders(workbookId: WorkbookId, folderPath: string, actor: Actor): Promise<ListFilesResponseDto> {
    await this.verifyWorkbookAccess(workbookId, actor);

    const result = await this.workbookDbService.workbookDb.listFilesAndFolders(workbookId, folderPath);

    // preprocess the list of files to create the appropriate folder entities
    const folderEntities: FileRefEntity[] = [];
    const uniqueFolderPaths = new Set<string>();
    for (const file of result) {
      const folderPath = extractFolderPath(file.path);
      if (!uniqueFolderPaths.has(folderPath)) {
        uniqueFolderPaths.add(folderPath);
        const { dir, base } = path.posix.parse(folderPath);
        const folderId = extractFolderId(folderPath);
        folderEntities.push({
          type: 'folder',
          id: `fil_fold_${folderId}`,
          name: base,
          parentPath: dir,
          path: folderPath,
        });
      }
    }

    const files = result.map(
      (f): FileRefEntity => ({
        type: 'file',
        id: f.id as FileId, // TODO: Type the DB record properly.
        path: f.path,
        name: f.name,
        parentPath: extractFolderPath(f.path),
      }),
    );

    const sortedFiles = [...folderEntities, ...files];
    sortedFiles.sort((a, b) => a.path.localeCompare(b.path));
    return { files: sortedFiles };
  }

  /**
   * Lists all of the files in a folder including full file content.
   */
  async getFilesByPath(workbookId: WorkbookId, folderPath: string, actor: Actor): Promise<ListFilesDetailsResponseDto> {
    await this.verifyWorkbookAccess(workbookId, actor);

    const result = await this.workbookDbService.workbookDb.listFilesAndFolders(workbookId, folderPath);

    const files = result.map((f) => ({
      ref: {
        type: 'file' as const,
        id: f.id as FileId,
        path: f.path,
        name: f.name,
        parentPath: extractFolderPath(f.path),
      },
      content: f.content,
      originalContent: f.original,
      suggestedContent: f.suggested,
      createdAt: f.created_at.toISOString(),
      updatedAt: f.updated_at.toISOString(),
    }));

    files.sort((a, b) => a.ref.path.localeCompare(b.ref.path));
    return { files };
  }

  /**
   * Get a single file by path
   */
  async getFileByPath(workbookId: WorkbookId, filePath: string, actor: Actor): Promise<FileDetailsResponseDto> {
    await this.verifyWorkbookAccess(workbookId, actor);

    const file = await this.workbookDbService.workbookDb.getFileByPath(workbookId, filePath);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return {
      file: {
        ref: {
          type: 'file',
          id: file.id as FileId,
          path: file.path,
          name: file.name,
          parentPath: extractFolderPath(file.path),
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
   * Create a new file with full path
   */
  async createFile(workbookId: WorkbookId, createFileDto: ValidatedCreateFileDto, actor: Actor): Promise<string> {
    await this.verifyWorkbookAccess(workbookId, actor);

    if (!createFileDto.path) {
      throw new NotFoundException('File path is required');
    }

    const filePath = await this.workbookDbService.workbookDb.createFileByPath(
      workbookId,
      createFileDto.path,
      createFileDto.content ?? null,
    );

    return filePath;
  }

  /**
   * Update an existing file by path
   */
  async updateFileByPath(
    workbookId: WorkbookId,
    currentPath: string,
    updateFileDto: ValidatedUpdateFileDto,
    actor: Actor,
  ): Promise<void> {
    await this.verifyWorkbookAccess(workbookId, actor);

    await this.workbookDbService.workbookDb.updateFileByPath(workbookId, currentPath, {
      newPath: updateFileDto.newPath,
      content: updateFileDto.content,
    });
  }

  /**
   * Delete a file by path (soft delete)
   */
  async deleteFileByPath(workbookId: WorkbookId, filePath: string, actor: Actor): Promise<void> {
    await this.verifyWorkbookAccess(workbookId, actor);

    await this.workbookDbService.workbookDb.deleteFileByPath(workbookId, filePath);
  }

  /**
   * Rename a folder by updating all files within it
   * Returns the number of files updated
   */
  async renameFolder(
    workbookId: WorkbookId,
    oldFolderPath: string,
    newFolderPath: string,
    actor: Actor,
  ): Promise<number> {
    await this.verifyWorkbookAccess(workbookId, actor);

    return this.workbookDbService.workbookDb.renameFolder(workbookId, oldFolderPath, newFolderPath);
  }
}
