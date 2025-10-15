/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { RequestWithUser } from '../auth/types';
import { ListUploadsResponseDto } from './dto/list-uploads.dto';
import { PreviewCsvResponseDto } from './dto/preview-csv.dto';
import { PreviewMdResponseDto } from './dto/preview-md.dto';
import { UploadCsvDto, UploadCsvResponseDto } from './dto/upload-csv.dto';
import { UploadMdResponseDto } from './dto/upload-md.dto';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(ScratchpadAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('csv/preview')
  @UseInterceptors(FileInterceptor('file'))
  async previewCsv(@UploadedFile() file: any, @Req() req: RequestWithUser): Promise<PreviewCsvResponseDto> {
    if (!file) {
      throw new Error('No file uploaded');
    }

    if (!file.mimetype.includes('csv') && !file.originalname.toLowerCase().endsWith('.csv')) {
      throw new Error('File must be a CSV');
    }

    return this.uploadsService.previewCsv(file.buffer);
  }

  @Post('md/preview')
  @UseInterceptors(FileInterceptor('file'))
  async previewMarkdown(@UploadedFile() file: any, @Req() req: RequestWithUser): Promise<PreviewMdResponseDto> {
    if (!file) {
      throw new Error('No file uploaded');
    }

    if (!file.mimetype.includes('markdown') && !file.originalname.toLowerCase().endsWith('.md')) {
      throw new Error('File must be a Markdown file');
    }

    return this.uploadsService.previewMarkdown(file.buffer, req.user.id);
  }

  @Post('csv')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCsv(
    @UploadedFile() file: any,
    @Body() body: UploadCsvDto,
    @Req() req: RequestWithUser,
  ): Promise<UploadCsvResponseDto> {
    if (!file) {
      throw new Error('No file uploaded');
    }

    if (!file.mimetype.includes('csv') && !file.originalname.toLowerCase().endsWith('.csv')) {
      throw new Error('File must be a CSV');
    }

    const result = await this.uploadsService.uploadCsv(file.buffer, req.user.id, body);

    return {
      uploadId: result.uploadId,
      tableId: result.tableId,
      rowCount: result.rowCount,
    };
  }

  @Post('md')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMarkdown(@UploadedFile() file: any, @Req() req: RequestWithUser): Promise<UploadMdResponseDto> {
    if (!file) {
      throw new Error('No file uploaded');
    }

    if (!file.mimetype.includes('markdown') && !file.originalname.toLowerCase().endsWith('.md')) {
      throw new Error('File must be a Markdown file');
    }

    const result = await this.uploadsService.uploadMarkdown(file.buffer, req.user.id, file.originalname);

    return {
      uploadId: result.uploadId,
      mdUploadId: result.mdUploadId,
      frontMatterKeys: result.frontMatterKeys,
    };
  }

  @Get()
  async listUploads(@Req() req: RequestWithUser): Promise<ListUploadsResponseDto> {
    const uploads = await this.uploadsService.listUploads(req.user.id);
    return { uploads };
  }

  @Get('csv/:id/data')
  async getCsvData(
    @Param('id') uploadId: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Req() req: RequestWithUser,
  ): Promise<{ rows: any[]; total: number }> {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    return this.uploadsService.getCsvData(uploadId, req.user.id, limitNum, offsetNum);
  }

  @Get('csv/:id/download')
  async downloadCsv(@Param('id') uploadId: string, @Req() req: RequestWithUser, @Res() res: Response): Promise<void> {
    await this.uploadsService.downloadCsv(uploadId, req.user.id, res);
  }

  @Get('md/:id/data')
  async getMdData(@Param('id') uploadId: string, @Req() req: RequestWithUser) {
    return this.uploadsService.getMdData(uploadId, req.user.id);
  }

  @Delete(':id')
  async deleteUpload(@Param('id') uploadId: string, @Req() req: RequestWithUser): Promise<{ message: string }> {
    await this.uploadsService.deleteUpload(uploadId, req.user.id);
    return { message: 'Upload deleted successfully' };
  }

  @Post('csv/:id/create-scratchpaper')
  async createScratchpaperFromCsv(
    @Param('id') uploadId: string,
    @Body() body: { name: string },
    @Req() req: RequestWithUser,
  ): Promise<{ snapshotId: string; tableId: string }> {
    return await this.uploadsService.createSnapshotFromCsvUpload(uploadId, req.user.id, body.name);
  }
}
