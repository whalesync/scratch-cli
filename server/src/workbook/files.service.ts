import { Injectable, NotFoundException } from '@nestjs/common';
import type { FileId, WorkbookId } from '@spinner/shared-types';
import {
  FileDetailsResponseDto,
  FileRefEntity,
  FolderRefEntity,
  ListFilesResponseDto,
  ValidatedCreateFileDto,
  ValidatedUpdateFileDto,
} from '@spinner/shared-types';
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
   * Lists files and folders in tree structure for file browser UI
   */
  async listFilesAndFolders(workbookId: WorkbookId, folderPath: string, actor: Actor): Promise<ListFilesResponseDto> {
    await this.verifyWorkbookAccess(workbookId, actor);

    const result = await this.workbookDbService.workbookDb.listFilesAndFolders(workbookId, folderPath);

    // TODO: Build into tree structure once return type is updated.
    const children: (FileRefEntity | FolderRefEntity)[] = [];
    for (const file of result) {
      children.push({
        type: 'file',
        id: file.id as FileId, // TODO: Type the DB record properly.
        path: 'NOT_IMPLEMENTED',
        name: file.name,
      });
    }

    return {
      root: {
        type: 'folder',
        path: folderPath,
        name: folderPath ? folderPath.split('/').pop() || folderPath : '',
        children,
      },
    };
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
        },
        content: file.content,
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
