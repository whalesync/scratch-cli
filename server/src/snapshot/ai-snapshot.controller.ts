import { Body, Controller, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SnapshotId } from 'src/types/ids';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { RequestWithUser, toActor } from '../auth/types';
import { SnapshotRecord } from '../remote-service/connectors/types';
import { SnapshotService } from './snapshot.service';

@Controller('ai-snapshot')
export class AiSnapshotController {
  constructor(private readonly service: SnapshotService) {}

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/records/active-view')
  async listActiveViewRecords(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Query('cursor') cursor: string | undefined,
    // @Query('take', new ParseIntPipe({ optional: true })) take = 10000,
    @Query('viewId') viewId: string | undefined,
    @Req() req: RequestWithUser,
  ): Promise<{ records: SnapshotRecord[]; nextCursor?: string; filteredRecordsCount: number }> {
    const result = await this.service.listRecordsForAi(snapshotId, tableId, toActor(req.user), cursor, viewId);
    return {
      records: result.records,
      nextCursor: result.nextCursor,
      filteredRecordsCount: result.filteredCount,
    };
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/records/by-ids')
  async getRecordsByIds(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Body() body: { recordIds: string[] },
    @Req() req: RequestWithUser,
  ): Promise<{ records: SnapshotRecord[]; totalCount: number }> {
    return await this.service.getRecordsByIdsForAi(snapshotId, tableId, body.recordIds, toActor(req.user));
  }
}
