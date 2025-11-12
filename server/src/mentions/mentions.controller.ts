import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { toActor } from 'src/auth/types';
import type { SnapshotId } from 'src/types/ids';
import { MentionsService } from './mentions.service';
import type { MentionsSearchRequestDto } from './types';
import { RecordMentionEntity, ResourceMentionEntity } from './types';

@Controller('mentions')
export class MentionsController {
  constructor(private readonly mentionsService: MentionsService) {}

  @UseGuards(ScratchpadAuthGuard)
  @Post('search/resources')
  async searchResources(
    @Body() body: MentionsSearchRequestDto,
    @Req() req: RequestWithUser,
  ): Promise<ResourceMentionEntity[]> {
    const { text } = body;
    return await this.mentionsService.searchResources({ actor: toActor(req.user), queryText: text });
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post('search/records')
  async searchRecords(
    @Body() body: MentionsSearchRequestDto,
    @Req() req: RequestWithUser,
  ): Promise<RecordMentionEntity[]> {
    const { text, snapshotId, tableId } = body;
    return await this.mentionsService.searchRecords({
      snapshotId: snapshotId as SnapshotId,
      actor: toActor(req.user),
      queryText: text,
      tableId,
    });
  }
}
