import { Body, ClassSerializerInterceptor, Controller, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { toActor } from 'src/auth/types';
import type { WorkbookId } from 'src/types/ids';
import { MentionsSearchRecordsRequestDto } from './dto/record-search.dto';
import { MentionsSearchResourcesRequestDto } from './dto/resource-search.dto';
import { RecordMentionEntity, ResourceMentionEntity } from './entities/mentions.entity';
import { MentionsService } from './mentions.service';

@Controller('mentions')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class MentionsController {
  constructor(private readonly mentionsService: MentionsService) {}

  @Post('search/resources')
  async searchResources(
    @Body() body: MentionsSearchResourcesRequestDto,
    @Req() req: RequestWithUser,
  ): Promise<ResourceMentionEntity[]> {
    const { text } = body;
    return await this.mentionsService.searchResources({ actor: toActor(req.user), queryText: text });
  }

  @Post('search/records')
  async searchRecords(
    @Body() body: MentionsSearchRecordsRequestDto,
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
