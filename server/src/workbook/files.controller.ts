import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { DataFolderId, WorkbookId } from '@spinner/shared-types';
import {
  CreateFileDto,
  FileDetailsResponseDto,
  FileRefEntity,
  ListFilesResponseDto,
  UpdateFileDto,
  ValidatedCreateFileDto,
} from '@spinner/shared-types';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { WSLogger } from '../logger';
import { DIRTY_BRANCH, ScratchGitService } from '../scratch-git/scratch-git.service';
import { userToActor } from '../users/types';
import { FilesService } from './files.service';

@Controller('workbooks/:workbookId/files')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly scratchGitService: ScratchGitService,
  ) {}

  /**
   * List files and folders at a given path (non-recursive, like `ls`).
   * GET /workbooks/:workbookId/files/list/by-path?path=/folder/path
   */
  @Get('list/by-folder')
  async listFilesByFolder(
    @Param('workbookId') workbookId: WorkbookId,
    @Query('folderId') folderId: DataFolderId,
    @Req() req: RequestWithUser,
  ): Promise<ListFilesResponseDto> {
    return await this.filesService.listByFolderId(workbookId, folderId, userToActor(req.user));
  }

  /**
   * Get a single file by its path.
   * GET /workbooks/:workbookId/files/by-path?path=/folder/file.md
   */
  @Get('by-path')
  async getFileByPath(
    @Param('workbookId') workbookId: WorkbookId,
    @Query('path') path: string,
    @Req() req: RequestWithUser,
  ): Promise<FileDetailsResponseDto> {
    return await this.filesService.getFileByPathGit(workbookId, path, userToActor(req.user));
  }

  /**
   * Update a file by path.
   * PATCH /workbooks/:workbookId/files/by-path?path=/folder/file.md
   */
  @Patch('by-path')
  @HttpCode(204)
  async updateFileByPath(
    @Param('workbookId') workbookId: WorkbookId,
    @Query('path') path: string,
    @Body() updateFileDto: UpdateFileDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.filesService.updateFileByPathGit(workbookId, path, updateFileDto, userToActor(req.user));
  }

  /**
   * Delete a file by path (like `rm`).
   * DELETE /workbooks/:workbookId/files/by-path?path=/folder/file.md
   */
  @Delete('by-path')
  @HttpCode(204)
  async deleteFileByPath(
    @Param('workbookId') workbookId: WorkbookId,
    @Query('path') path: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    // Verify user has access to this workbook
    await this.filesService.verifyWorkbookAccess(workbookId, userToActor(req.user));

    try {
      await this.scratchGitService.deleteFile(workbookId, [path], `Delete ${path}`);
    } catch (e) {
      WSLogger.error({
        source: 'FilesController.deleteFileByPath',
        message: 'Failed to delete file from git',
        path,
        workbookId,
        error: e instanceof Error ? e.message : String(e),
      });
      throw new NotFoundException(`Failed to delete file: ${path}`);
    }
  }

  /**
   * Create a new file
   * POST /workbooks/:workbookId/files
   */
  @Post()
  async createFile(
    @Param('workbookId') workbookId: WorkbookId,
    @Body() createFileDto: CreateFileDto,
    @Req() req: RequestWithUser,
  ): Promise<FileRefEntity> {
    const dto = createFileDto as ValidatedCreateFileDto;
    const file = await this.filesService.createFile(workbookId, dto, userToActor(req.user));

    if (file.type === 'file') {
      try {
        await this.scratchGitService.commitFile(workbookId, file.path, dto.content || '', `Create ${file.path}`);
      } catch (e) {
        WSLogger.error({
          source: 'FilesController.createFile',
          message: 'Failed to auto-commit file creation',
          error: e,
          workbookId,
        });
      }
    }

    return file;
  }

  /**
   * Publish a file (commit to main and rebase dirty)
   * POST /workbooks/:workbookId/files/:fileId/publish
   */
  @Post('publish')
  @HttpCode(204)
  async publishFile(@Param('workbookId') workbookId: WorkbookId, @Body() body: { path: string }): Promise<void> {
    const { path } = body;

    try {
      // Fetch current content from dirty branch directly from git
      const fileContent = await this.scratchGitService.getRepoFile(workbookId, DIRTY_BRANCH, path);

      if (!fileContent) {
        throw new Error('File not found in git dirty branch');
      }

      await this.scratchGitService.publishFile(workbookId, path, fileContent.content, `Publish ${path}`);
    } catch (e) {
      WSLogger.error({
        source: 'FilesController.publishFile',
        message: 'Failed to publish file',
        error: e,
        workbookId,
      });
      throw e;
    }
  }
}
