import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { WorkbookId } from '@spinner/shared-types';
import {
  CreateFileDto,
  FileDetailsResponseDto,
  ListFileDto,
  ListFilesResponseDto,
  UpdateFileDto,
  ValidatedCreateFileDto,
} from '@spinner/shared-types';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { userToActor } from '../users/types';
import { FilesService } from './files.service';

@Controller('workbooks/:workbookId/files')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * List files and folders in a directory (tree structure)
   * GET /workbooks/:workbookId/files/list or /workbooks/:workbookId/files/list/path/to/folder
   */
  @Get(['list', 'list/*'])
  async listFiles(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('*') folderPath: string,
    @Query() query: ListFileDto,
    @Req() req: RequestWithUser,
  ): Promise<ListFilesResponseDto> {
    // Default to empty string for root if no path provided
    const cleanPath = folderPath || query.folderPath || '';

    const result = await this.filesService.listFilesAndFolders(workbookId, cleanPath, userToActor(req.user));

    return result;
  }

  /**
   * Get a single file by path
   * GET /workbooks/:workbookId/files/path/to/file.md
   */
  @Get('*')
  async getFile(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('*') filePath: string,
    @Req() req: RequestWithUser,
  ): Promise<FileDetailsResponseDto> {
    const result = await this.filesService.getFileByPath(workbookId, filePath, userToActor(req.user));
    return result;
  }

  /**
   * Create a new file
   * POST /workbooks/:workbookId/files with path in body
   */
  @Post()
  async createFile(
    @Param('workbookId') workbookId: WorkbookId,
    @Body() createFileDto: CreateFileDto,
    @Req() req: RequestWithUser,
  ): Promise<{ path: string }> {
    const dto = createFileDto as ValidatedCreateFileDto;
    const path = await this.filesService.createFile(workbookId, dto, userToActor(req.user));
    return { path };
  }

  /**
   * Update a file by path
   * PATCH /workbooks/:workbookId/files/path/to/file.md
   */
  @Patch('*')
  @HttpCode(204)
  async updateFile(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('*') filePath: string,
    @Body() updateFileDto: UpdateFileDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.filesService.updateFileByPath(workbookId, filePath, updateFileDto, userToActor(req.user));
  }

  /**
   * Delete a file by path
   * DELETE /workbooks/:workbookId/files/path/to/file.md
   */
  @Delete('*')
  @HttpCode(204)
  async deleteFile(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('*') filePath: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.filesService.deleteFileByPath(workbookId, filePath, userToActor(req.user));
  }

  /**
   * Rename a folder
   * POST /workbooks/:workbookId/files/rename-folder
   */
  @Post('rename-folder')
  async renameFolder(
    @Param('workbookId') workbookId: WorkbookId,
    @Body() body: { oldPath: string; newPath: string },
    @Req() req: RequestWithUser,
  ): Promise<{ filesUpdated: number }> {
    const filesUpdated = await this.filesService.renameFolder(
      workbookId,
      body.oldPath,
      body.newPath,
      userToActor(req.user),
    );
    return { filesUpdated };
  }
}
