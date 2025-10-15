import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { SnapshotId } from 'src/types/ids';
import { SnapshotService } from './snapshot.service';

/**
 * Public endpoints for snapshots that don't require authentication.
 * Security relies on snapshot IDs being unguessable.
 */
@Controller('snapshot/public')
export class SnapshotPublicController {
  constructor(private readonly snapshotService: SnapshotService) {}

  @Get(':id/export-as-csv')
  async exportAsCsv(
    @Param('id') snapshotId: SnapshotId,
    @Query('tableId') tableId: string,
    @Query('filteredOnly') filteredOnly: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.snapshotService.exportAsCsvPublic(snapshotId, tableId, filteredOnly === 'true', res);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        res.status(404).send('Snapshot or table not found');
      } else {
        res.status(500).send('Failed to export CSV');
      }
    }
  }
}
