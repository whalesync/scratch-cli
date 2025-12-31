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
   * GET /workbooks/:workbookId/files/list?path=path/to/folder
   */
  @Get('list')
  async listFiles(
    @Param('workbookId') workbookId: WorkbookId,

    @Query('path') folderPath: string = '/',

    @Req() req: RequestWithUser,
  ): Promise<ListFilesResponseDto> {
    const filesAndFolders = await this.filesService.listFilesAndFolders(workbookId, folderPath, userToActor(req.user));
    return filesAndFolders;
    // Hardcoded fake data: 3 levels with 10 files total
    /*
    return {
      files: [
        {
          type: 'folder',
          id: 'fil_fold_1',
          path: '/docs',
          name: 'docs',
          parentPath: '/',
        },
        { type: 'file', id: 'fil_1', path: '/docs/readme.md', name: 'readme.md', parentPath: '/docs' },
        { type: 'file', id: 'fil_2', path: '/docs/guide.md', name: 'guide.md', parentPath: '/docs' },
        {
          type: 'folder',
          id: 'fil_fold_2',
          path: '/docs/api',
          name: 'api',
          parentPath: '/docs',
        },
        { type: 'file', id: 'fil_3', path: '/docs/api/endpoints.md', name: 'endpoints.md', parentPath: '/docs/api' },
        { type: 'file', id: 'fil_4', path: '/docs/api/auth.md', name: 'auth.md', parentPath: '/docs/api' },

        {
          type: 'folder',
          id: 'fil_fold_3',
          path: '/src',
          name: 'src',
          parentPath: '/',
        },
        { type: 'file', id: 'fil_5', path: '/src/index.ts', name: 'index.ts', parentPath: '/src' },
        { type: 'file', id: 'fil_6', path: '/src/app.ts', name: 'app.ts', parentPath: '/src' },
        {
          type: 'folder',
          id: 'fil_fold_4',
          path: '/src/utils',
          name: 'utils',
          parentPath: '/src',
        },
        { type: 'file', id: 'fil_7', path: '/src/utils/helper.ts', name: 'helper.ts', parentPath: '/src/utils' },
        { type: 'file', id: 'fil_8', path: '/src/utils/logger.ts', name: 'logger.ts', parentPath: '/src/utils' },
        { type: 'file', id: 'fil_9', path: '/package.json', name: 'package.json', parentPath: '/' },
        { type: 'file', id: 'fil_10', path: '/tsconfig.json', name: 'tsconfig.json', parentPath: '/' },
      ],
    };
    */
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

  /**
   * Get a single file by path
   * GET /workbooks/:workbookId/files/file?path=path/to/file.md
   */
  @Get('file')
  async getFile(
    @Param('workbookId') workbookId: WorkbookId,
    @Query('path') filePath: string,

    @Req() req: RequestWithUser,
  ): Promise<FileDetailsResponseDto> {
    // Hardcoded fake data with 1-word content
    return await this.filesService.getFileByPath(workbookId, filePath, userToActor(req.user));
    /*
    const fileName = filePath.split('/').pop() || 'unknown';
    return {
      file: {
        ref: {
          type: 'file',
          id: 'fil_fake',
          path: filePath,
          name: fileName,
          parentPath: filePath.split('/').slice(0, -1).join('/'),
        },
        content: `Placeholder content for ${filePath}`,
      },
    };
    */
  }

  /**
   * Update a file by path
   * PATCH /workbooks/:workbookId/files/file?path=path/to/file.md
   */
  @Patch('file')
  @HttpCode(204)
  async updateFile(
    @Param('workbookId') workbookId: WorkbookId,
    @Query('path') filePath: string,
    @Body() updateFileDto: UpdateFileDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.filesService.updateFileByPath(workbookId, filePath, updateFileDto, userToActor(req.user));
  }

  /**
   * Delete a file by path
   * DELETE /workbooks/:workbookId/files/file?path=path/to/file.md
   */
  @Delete('file')
  @HttpCode(204)
  async deleteFile(
    @Param('workbookId') workbookId: WorkbookId,
    @Query('path') filePath: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.filesService.deleteFileByPath(workbookId, filePath, userToActor(req.user));
  }
}
