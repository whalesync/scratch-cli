import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { UploadsService } from './uploads.service';

/**
 * Public endpoints for uploads that don't require authentication.
 * Security relies on upload IDs being unguessable.
 */
@Controller('uploads/public')
@UseInterceptors(ClassSerializerInterceptor)
export class UploadsPublicController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('csv/:id/download')
  async downloadCsv(@Param('id') uploadId: string, @Res() res: Response): Promise<void> {
    try {
      await this.uploadsService.downloadCsvPublic(uploadId, res);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        res.status(404).send('Upload not found');
      } else {
        res.status(500).send('Failed to download CSV');
      }
    }
  }
}
