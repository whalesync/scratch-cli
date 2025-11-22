import { Body, ClassSerializerInterceptor, Controller, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ScratchpadAuthGuard } from '../../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../../auth/types';
import { toActor } from '../../auth/types';
import { ValidatedWixPublishDraftPostsDto, WixPublishDraftPostsDto } from './dto/publish-draft-posts.dto';
import { WixCustomActionsService } from './wix-custom-actions.service';

@Controller('custom-actions/wix')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class WixCustomActionsController {
  constructor(private readonly service: WixCustomActionsService) {}

  @Post('publish-draft-posts')
  async publishDraftPosts(@Body() dtoParam: WixPublishDraftPostsDto, @Req() req: RequestWithUser) {
    const dto = dtoParam as ValidatedWixPublishDraftPostsDto;
    return this.service.publishDraftPosts(dto, toActor(req.user));
  }
}
