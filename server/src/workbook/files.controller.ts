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
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { FileId, FolderId, ListFilesDetailsResponseDto, WorkbookId } from '@spinner/shared-types';
import {
  CopyFileDto,
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
   * GET /workbooks/:workbookId/files/list/details?folderId=folder-id
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
   * List files and folders at a given path (non-recursive, like `ls`).
   * GET /workbooks/:workbookId/files/list/by-path?path=/folder/path
   */
  @Get('list/by-path')
  async listFilesByPath(
    @Param('workbookId') workbookId: WorkbookId,
    @Query('path') path: string = '/',
    @Req() req: RequestWithUser,
  ): Promise<ListFilesResponseDto> {
    return await this.filesService.listByPath(workbookId, path, userToActor(req.user));
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
    return await this.filesService.getFileByPath(workbookId, path, userToActor(req.user));
  }

  /**
   * Find files matching a name pattern (like `find`).
   * GET /workbooks/:workbookId/files/find?pattern=*.md&path=/emails
   * @param pattern - Glob pattern for file name (e.g., "*.md", "test*", "file?.txt")
   * @param path - Optional path prefix to search within
   */
  @Get('find')
  async findFiles(
    @Param('workbookId') workbookId: WorkbookId,
    @Query('pattern') pattern: string,
    @Query('path') path?: string,
    @Query('recursive') recursive: string = 'true',
    @Req() req?: RequestWithUser,
  ): Promise<ListFilesResponseDto> {
    const isRecursive = recursive !== 'false';
    return await this.filesService.findFiles(workbookId, pattern, path, isRecursive, userToActor(req!.user));
  }

  /**
   * Search file contents for a pattern (like `grep`).
   * GET /workbooks/:workbookId/files/grep?pattern=searchText&path=/emails
   * @param pattern - Text to search for in file contents (case-insensitive)
   * @param path - Optional path prefix to search within
   */
  @Get('grep')
  async grepFiles(
    @Param('workbookId') workbookId: WorkbookId,
    @Query('pattern') pattern: string,
    @Query('path') path?: string,
    @Req() req?: RequestWithUser,
  ): Promise<{ matches: Array<{ file: FileRefEntity; matchCount: number; excerpts: string[] }> }> {
    return await this.filesService.grepFiles(workbookId, pattern, path, userToActor(req!.user));
  }

  /**
   * Write/update a file by path (like `write` or `echo >`).
   * Creates the file if it doesn't exist, updates if it does.
   * PUT /workbooks/:workbookId/files/write-by-path
   */
  @Put('write-by-path')
  async writeFileByPath(
    @Param('workbookId') workbookId: WorkbookId,
    @Body() body: { path: string; content: string },
    @Req() req: RequestWithUser,
  ): Promise<FileRefEntity> {
    return await this.filesService.writeFileByPath(workbookId, body.path, body.content, userToActor(req.user));
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
    await this.filesService.deleteFileByPath(workbookId, path, userToActor(req.user));
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

  /**
   * Copy a file to a target folder
   * POST /workbooks/:workbookId/files/:fileId/copy
   */
  @Post(':fileId/copy')
  async copyFile(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('fileId') fileId: FileId,
    @Body() copyFileDto: CopyFileDto,
    @Req() req: RequestWithUser,
  ): Promise<FileRefEntity> {
    const dto = copyFileDto;
    return await this.filesService.copyFile(workbookId, fileId, dto.targetFolderId ?? null, userToActor(req.user));
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
