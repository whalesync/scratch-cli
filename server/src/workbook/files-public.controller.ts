import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import type { FileId, FolderId, WorkbookId } from '@spinner/shared-types';
import type { Response } from 'express';
import { WSLogger } from 'src/logger';
import { FilesService } from './files.service';

/**
 * Public endpoints for files that don't require authentication.
 * Security relies on workbook IDs being unguessable.
 */
@Controller('workbook/public')
@UseInterceptors(ClassSerializerInterceptor)
export class FilesPublicController {
  constructor(private readonly filesService: FilesService) {}

  @Get(':id/files/download')
  async downloadFile(
    @Param('id') workbookId: WorkbookId,
    @Query('fileId') fileId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { content, name } = await this.filesService.downloadFileAsMarkdownPublic(workbookId, fileId as FileId);

      const encodedFilename = encodeURIComponent(name);

      // Set headers for markdown download
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"; filename*=UTF-8''${encodedFilename}`);

      // Send the content
      res.send(content);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        res.status(404).send('File not found');
      } else {
        WSLogger.error({
          source: FilesPublicController.name,
          message: 'Failed to download file',
          error: error,
          workbookId: workbookId,
          fileId: fileId,
        });
        res.status(500).send('Failed to download file');
      }
    }
  }

  @Get(':id/folders/download')
  async downloadFolder(
    @Param('id') workbookId: WorkbookId,
    @Query('folderId') folderId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { stream, name } = await this.filesService.downloadFolderAsZipPublic(workbookId, folderId as FolderId);

      const encodedFilename = encodeURIComponent(name);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${name}.zip"; filename*=UTF-8''${encodedFilename}.zip`,
      );

      stream.pipe(res);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        res.status(404).send('Folder not found');
      } else {
        WSLogger.error({
          source: FilesPublicController.name,
          message: 'Failed to download folder',
          error: error,
          workbookId: workbookId,
          folderId: folderId,
        });
        res.status(500).send('Failed to download folder');
      }
    }
  }
}
