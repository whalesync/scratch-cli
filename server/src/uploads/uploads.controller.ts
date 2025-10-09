/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Body, Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PostgresColumnType } from 'src/remote-service/connectors/types';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { RequestWithUser } from '../auth/types';
import { CsvPreviewResponse, UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(ScratchpadAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('preview-csv')
  @UseInterceptors(FileInterceptor('file'))
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async previewCsv(@UploadedFile() file: any, @Req() req: RequestWithUser): Promise<CsvPreviewResponse> {
    if (!file) {
      throw new Error('No file uploaded');
    }

    if (!file.mimetype.includes('csv') && !file.originalname.toLowerCase().endsWith('.csv')) {
      throw new Error('File must be a CSV');
    }

    return this.uploadsService.previewCsv(file.buffer);
  }

  @Post('import-csv')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @UploadedFile() file: any,
    @Body()
    body: {
      scratchpaperName: string;
      columnNames: string[]; // Array from form data
      columnTypes: PostgresColumnType[]; // Array from form data
      firstRowIsHeader: boolean; // Boolean from form data
    },
    @Req() req: RequestWithUser,
  ): Promise<{ snapshotId: string; tableId: string }> {
    if (!file) {
      throw new Error('No file uploaded');
    }

    if (!file.mimetype.includes('csv') && !file.originalname.toLowerCase().endsWith('.csv')) {
      throw new Error('File must be a CSV');
    }

    if (!body.scratchpaperName || !body.columnNames || !body.columnTypes) {
      throw new Error('Missing required parameters: scratchpaperName, columnNames, columnTypes');
    }

    return this.uploadsService.importCsv(
      file.buffer,
      req.user.id,
      body.scratchpaperName,
      body.columnNames,
      body.columnTypes,
      body.firstRowIsHeader,
    );
  }

  @Post('create-template')
  async createTemplate(
    @Body() body: { scratchpaperName: string },
    @Req() req: RequestWithUser,
  ): Promise<{ snapshotId: string; tableId: string }> {
    if (!body.scratchpaperName) {
      throw new Error('Missing required parameter: scratchpaperName');
    }

    return await this.uploadsService.createTemplate(req.user.id, body.scratchpaperName);
  }
}
