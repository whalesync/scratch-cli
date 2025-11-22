/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Body,
  ClassSerializerInterceptor,
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
import type { Response } from 'express';
import { BaseColumnSpec } from 'src/remote-service/connectors/types';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { toActor } from '../auth/types';
import {
  CreateWorkbookFromCsvDto,
  CreateWorkbookFromCsvResponseDto,
  ValidatedCreateWorkbookFromCsvDto,
} from './dto/create-workbook-from-csv.dto';
import { ListUploadsResponseDto } from './dto/list-uploads.dto';
import { PreviewCsvResponseDto } from './dto/preview-csv.dto';
import { PreviewMdResponseDto } from './dto/preview-md.dto';
import { CsvAdvancedSettings, type UploadCsvDto, UploadCsvResponseDto } from './dto/upload-csv.dto';
import { UploadMdResponseDto } from './dto/upload-md.dto';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
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

    return this.uploadsService.previewMarkdown(file.buffer, toActor(req.user));
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

    // Parse advancedSettings if it's a JSON string
    if (body.advancedSettings && typeof body.advancedSettings === 'string') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const parsed = JSON.parse(body.advancedSettings);
        body.advancedSettings = parsed as CsvAdvancedSettings;
      } catch (error) {
        // If parsing fails, ignore and use defaults
        body.advancedSettings = {};
      }
    }

    const result = await this.uploadsService.uploadCsv(file.buffer, toActor(req.user), body);

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

    const result = await this.uploadsService.uploadMarkdown(file.buffer, toActor(req.user), file.originalname);

    return {
      uploadId: result.uploadId,
      mdUploadId: result.mdUploadId,
      frontMatterKeys: result.frontMatterKeys,
    };
  }

  @Get()
  async listUploads(@Req() req: RequestWithUser): Promise<ListUploadsResponseDto> {
    const uploads = await this.uploadsService.listUploads(toActor(req.user));
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

    return this.uploadsService.getCsvData(uploadId, toActor(req.user), limitNum, offsetNum);
  }

  @Get('csv/:id/columns')
  async getCsvColumns(@Param('id') uploadId: string, @Req() req: RequestWithUser): Promise<BaseColumnSpec[]> {
    return this.uploadsService.getCsvColumnsForUpload(uploadId, toActor(req.user));
  }

  @Get('csv/:id/download')
  async downloadCsv(@Param('id') uploadId: string, @Req() req: RequestWithUser, @Res() res: Response): Promise<void> {
    await this.uploadsService.downloadCsv(uploadId, toActor(req.user), res);
  }

  @Get('md/:id/data')
  async getMdData(@Param('id') uploadId: string, @Req() req: RequestWithUser) {
    return this.uploadsService.getMdData(uploadId, toActor(req.user));
  }

  @Delete(':id')
  async deleteUpload(@Param('id') uploadId: string, @Req() req: RequestWithUser): Promise<{ message: string }> {
    await this.uploadsService.deleteUpload(uploadId, toActor(req.user));
    return { message: 'Upload deleted successfully' };
  }

  @Post('csv/:id/create-scratchpaper')
  async createScratchpaperFromCsv(
    @Param('id') uploadId: string,
    @Body() body: CreateWorkbookFromCsvDto,
    @Req() req: RequestWithUser,
  ): Promise<CreateWorkbookFromCsvResponseDto> {
    const dto = body as ValidatedCreateWorkbookFromCsvDto;
    return await this.uploadsService.createWorkbookFromCsvUpload(
      uploadId,
      toActor(req.user),
      dto.name,
      dto.titleColumnRemoteId,
    );
  }
}
