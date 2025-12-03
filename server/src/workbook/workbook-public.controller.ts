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
import { WSLogger } from 'src/logger';
import { WorkbookService } from './workbook.service';

/**
 * Public endpoints for snapshots that don't require authentication.
 * Security relies on snapshot IDs being unguessable.
 */
@Controller('workbook/public')
@UseInterceptors(ClassSerializerInterceptor)
export class WorkbookPublicController {
  constructor(private readonly workbookService: WorkbookService) {}

  @Get(':id/export-as-csv')
  async exportAsCsv(
    @Param('id') workbookId: WorkbookId,
    @Query('tableId') tableId: string,
    @Query('filteredOnly') filteredOnly: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.workbookService.exportAsCsvPublic(workbookId, tableId, filteredOnly === 'true', res);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        res.status(404).send('Workbook or table not found');
      } else {
        WSLogger.error({
          source: WorkbookPublicController.name,
          message: 'Failed to export workbook CSV',
          error: error,
          workbookId: workbookId,
          tableId: tableId,
          filteredOnly: filteredOnly,
        });
        res.status(500).send('Failed to export CSV');
      }
    }
  }
}
