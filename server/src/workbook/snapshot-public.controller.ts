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
import type { WorkbookId } from '@spinner/shared-types';
import type { Response } from 'express';
import { WorkbookService } from './workbook.service';

/**
 * Public endpoints for snapshots that don't require authentication.
 * Security relies on snapshot IDs being unguessable.
 */
@Controller('snapshot/public')
@UseInterceptors(ClassSerializerInterceptor)
export class SnapshotPublicController {
  constructor(private readonly snapshotService: WorkbookService) {}

  @Get(':id/export-as-csv')
  async exportAsCsv(
    @Param('id') workbookId: WorkbookId,
    @Query('tableId') tableId: string,
    @Query('filteredOnly') filteredOnly: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.snapshotService.exportAsCsvPublic(workbookId, tableId, filteredOnly === 'true', res);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        res.status(404).send('Snapshot or table not found');
      } else {
        res.status(500).send('Failed to export CSV');
      }
    }
  }
}
