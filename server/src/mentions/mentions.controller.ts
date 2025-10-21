import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import { RequestWithUser } from 'src/auth/types';
import { MentionsService } from './mentions.service';

export type MentionsSearchRequestDto = {
  text: string;
  snapshotId: string;
  tableId?: string; // optional; demo may hardcode on client
};

export type ResourceMention = {
  id: string;
  title: string;
};

export type RecordMention = {
  id: string; // record wsId
  title: string;
  tableId: string;
};

export type MentionsSearchResponseDto = {
  resources: ResourceMention[];
  records: RecordMention[];
};

@Controller('mentions')
export class MentionsController {
  constructor(private readonly mentionsService: MentionsService) {}

  @UseGuards(ScratchpadAuthGuard)
  @Post('search')
  async search(
    @Body() body: MentionsSearchRequestDto,
    @Req() req: RequestWithUser,
  ): Promise<MentionsSearchResponseDto> {
    const userId = req.user.id;
    const { text, snapshotId, tableId } = body;
    return await this.mentionsService.searchMentions({ text, snapshotId, userId, tableId });
  }
}
