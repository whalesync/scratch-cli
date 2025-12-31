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
  // eslint-disable-next-line @typescript-eslint/require-await
  async listFiles(
    @Param('workbookId') workbookId: WorkbookId,
    @Query('path') folderPath: string = '',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Req() req: RequestWithUser,
  ): Promise<ListFilesResponseDto> {
    // Hardcoded fake data: 3 levels with 10 files total
    return {
      root: {
        type: 'folder',
        path: folderPath || '',
        name: 'root',
        children: [
          {
            type: 'folder',
            path: 'docs',
            name: 'docs',
            children: [
              { type: 'file', id: 'fil_1', path: 'docs/readme.md', name: 'readme.md' },
              { type: 'file', id: 'fil_2', path: 'docs/guide.md', name: 'guide.md' },
              {
                type: 'folder',
                path: 'docs/api',
                name: 'api',
                children: [
                  { type: 'file', id: 'fil_3', path: 'docs/api/endpoints.md', name: 'endpoints.md' },
                  { type: 'file', id: 'fil_4', path: 'docs/api/auth.md', name: 'auth.md' },
                ],
              },
            ],
          },
          {
            type: 'folder',
            path: 'src',
            name: 'src',
            children: [
              { type: 'file', id: 'fil_5', path: 'src/index.ts', name: 'index.ts' },
              { type: 'file', id: 'fil_6', path: 'src/app.ts', name: 'app.ts' },
              {
                type: 'folder',
                path: 'src/utils',
                name: 'utils',
                children: [
                  { type: 'file', id: 'fil_7', path: 'src/utils/helper.ts', name: 'helper.ts' },
                  { type: 'file', id: 'fil_8', path: 'src/utils/logger.ts', name: 'logger.ts' },
                ],
              },
            ],
          },
          { type: 'file', id: 'fil_9', path: 'package.json', name: 'package.json' },
          { type: 'file', id: 'fil_10', path: 'tsconfig.json', name: 'tsconfig.json' },
        ],
      },
    };
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
  // eslint-disable-next-line @typescript-eslint/require-await
  async getFile(
    @Param('workbookId') workbookId: WorkbookId,
    @Query('path') filePath: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Req() req: RequestWithUser,
  ): Promise<FileDetailsResponseDto> {
    // Hardcoded fake data with 1-word content
    const fileName = filePath.split('/').pop() || 'unknown';
    return {
      file: {
        ref: {
          type: 'file',
          id: 'fil_fake',
          path: filePath,
          name: fileName,
        },
        content: `Placeholder content for ${filePath}`,
      },
    };
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
