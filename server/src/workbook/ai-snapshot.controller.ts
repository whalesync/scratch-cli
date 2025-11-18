import { Body, Controller, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { WorkbookId } from 'src/types/ids';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { toActor } from '../auth/types';
import { SnapshotRecord } from '../remote-service/connectors/types';
import { WorkbookService } from './workbook.service';

@Controller('ai-snapshot')
@UseGuards(ScratchpadAuthGuard)
export class AiSnapshotController {
  constructor(private readonly service: WorkbookService) {}

  @Post(':id/tables/:tableId/records/active-view')
  async listActiveViewRecords(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Query('cursor') cursor: string | undefined,
    @Req() req: RequestWithUser,
  ): Promise<{ records: SnapshotRecord[]; nextCursor?: string; filteredRecordsCount: number }> {
    const result = await this.service.listRecordsForAi(workbookId, tableId, toActor(req.user), cursor);
    return {
      records: result.records,
      nextCursor: result.nextCursor,
      filteredRecordsCount: result.filteredCount,
    };
  }

  @Post(':id/tables/:tableId/records/by-ids')
  async getRecordsByIds(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() body: { recordIds: string[] },
    @Req() req: RequestWithUser,
  ): Promise<{ records: SnapshotRecord[]; totalCount: number }> {
    return await this.service.getRecordsByIdsForAi(workbookId, tableId, body.recordIds, toActor(req.user));
  }
}
