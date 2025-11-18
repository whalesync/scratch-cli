import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { toActor } from 'src/auth/types';
import type { WorkbookId } from 'src/types/ids';
import { MentionsService } from './mentions.service';
import type { MentionsSearchRequestDto } from './types';
import { RecordMentionEntity, ResourceMentionEntity } from './types';

@Controller('mentions')
@UseGuards(ScratchpadAuthGuard)
export class MentionsController {
  constructor(private readonly mentionsService: MentionsService) {}

  @Post('search/resources')
  async searchResources(
    @Body() body: MentionsSearchRequestDto,
    @Req() req: RequestWithUser,
  ): Promise<ResourceMentionEntity[]> {
    const { text } = body;
    return await this.mentionsService.searchResources({ actor: toActor(req.user), queryText: text });
  }

  @Post('search/records')
  async searchRecords(
    @Body() body: MentionsSearchRequestDto,
    @Req() req: RequestWithUser,
  ): Promise<RecordMentionEntity[]> {
    const { text, workbookId, tableId } = body;
    return await this.mentionsService.searchRecords({
      workbookId: workbookId as WorkbookId,
      actor: toActor(req.user),
      queryText: text,
      tableId,
    });
  }
}
