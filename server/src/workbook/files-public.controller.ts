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
import type { FileId, WorkbookId } from '@spinner/shared-types';
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
}
