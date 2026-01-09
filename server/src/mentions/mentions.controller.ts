import { Body, ClassSerializerInterceptor, Controller, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import type { WorkbookId } from '@spinner/shared-types';
import { MentionsSearchRecordsRequestDto, ValidatedMentionsSearchRecordsRequestDto } from '@spinner/shared-types';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { userToActor } from 'src/users/types';
import { RecordMentionEntity } from './entities/mentions.entity';
import { MentionsService } from './mentions.service';

@Controller('mentions')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class MentionsController {
  constructor(private readonly mentionsService: MentionsService) {}

  @Post('search/records')
  async searchRecords(
    @Body() body: MentionsSearchRecordsRequestDto,
    @Req() req: RequestWithUser,
  ): Promise<RecordMentionEntity[]> {
    const dto = body as ValidatedMentionsSearchRecordsRequestDto;
    const { text, workbookId, tableId } = dto;
    return await this.mentionsService.searchRecords({
      workbookId: workbookId as WorkbookId,
      actor: userToActor(req.user),
      queryText: text,
      tableId,
    });
  }
}
