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
import type { FileId, FolderId, ListFilesDetailsResponseDto, WorkbookId } from '@spinner/shared-types';
import {
  CreateFileDto,
  CreateFolderDto,
  FileDetailsResponseDto,
  FileRefEntity,
  FolderResponseDto,
  ListFilesResponseDto,
  UpdateFileDto,
  UpdateFolderDto,
  ValidatedCreateFileDto,
  ValidatedCreateFolderDto,
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
   * List all files and folders in a workbook
   * GET /workbooks/:workbookId/files/list
   */
  @Get('list')
  async listFiles(
    @Param('workbookId') workbookId: WorkbookId,

    @Req() req: RequestWithUser,
  ): Promise<ListFilesResponseDto> {
    return await this.filesService.listFilesAndFolders(workbookId, userToActor(req.user));
  }

  /**
   * List all of the files in a folder including full file content.
   * GET /workbooks/:workbookId/files/list/details?path=path/to/folder
   */
  @Get('list/details')
  async listFilesDetails(
    @Param('workbookId') workbookId: WorkbookId,
    @Query('folderId') folderId: string | null = null,
    @Req() req: RequestWithUser,
  ): Promise<ListFilesDetailsResponseDto> {
    const filesMetadata = await this.filesService.getFilesByFolderId(
      workbookId,
      folderId as FolderId | null,
      userToActor(req.user),
    );
    return filesMetadata;
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
    return await this.filesService.createFile(workbookId, dto, userToActor(req.user));
  }

  /**
   * Get a single file by ID
   * GET /workbooks/:workbookId/files/:fileId
   */
  @Get(':fileId')
  async getFile(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('fileId') fileId: FileId,
    @Req() req: RequestWithUser,
  ): Promise<FileDetailsResponseDto> {
    return await this.filesService.getFileById(workbookId, fileId, userToActor(req.user));
  }

  /**
   * Update a file by ID
   * PATCH /workbooks/:workbookId/files/:fileId
   */
  @Patch(':fileId')
  @HttpCode(204)
  async updateFile(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('fileId') fileId: FileId,
    @Body() updateFileDto: UpdateFileDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.filesService.updateFile(workbookId, fileId, updateFileDto, userToActor(req.user));
  }

  /**
   * Delete a file by ID
   * DELETE /workbooks/:workbookId/files/:fileId
   */
  @Delete(':fileId')
  @HttpCode(204)
  async deleteFile(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('fileId') fileId: FileId,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.filesService.deleteFile(workbookId, fileId, userToActor(req.user));
  }
}

/**
 * Separate controller for folder operations
 */
@Controller('workbooks/:workbookId/folders')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class FoldersController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Create a new folder
   * POST /workbooks/:workbookId/folders
   */
  @Post()
  async createFolder(
    @Param('workbookId') workbookId: WorkbookId,
    @Body() createFolderDto: CreateFolderDto,
    @Req() req: RequestWithUser,
  ): Promise<FolderResponseDto> {
    const dto = createFolderDto as ValidatedCreateFolderDto;
    return await this.filesService.createFolder(workbookId, dto, userToActor(req.user));
  }

  /**
   * Update a folder by ID (rename or move)
   * PATCH /workbooks/:workbookId/folders/:folderId
   */
  @Patch(':folderId')
  async updateFolder(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('folderId') folderId: FolderId,
    @Body() updateFolderDto: UpdateFolderDto,
    @Req() req: RequestWithUser,
  ): Promise<FolderResponseDto> {
    return await this.filesService.updateFolder(workbookId, folderId, updateFolderDto, userToActor(req.user));
  }

  /**
   * Delete a folder by ID
   * DELETE /workbooks/:workbookId/folders/:folderId
   */
  @Delete(':folderId')
  @HttpCode(204)
  async deleteFolder(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('folderId') folderId: FolderId,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.filesService.deleteFolder(workbookId, folderId, userToActor(req.user));
  }
}
