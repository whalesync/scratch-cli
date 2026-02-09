import { Body, ClassSerializerInterceptor, Controller, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ValidatedWixPublishDraftPostsDto, WixPublishDraftPostsDto } from '@spinner/shared-types';
import { ScratchAuthGuard } from '../../auth/scratch-auth.guard';
import type { RequestWithUser } from '../../auth/types';
import { userToActor } from '../../users/types';
import { WixCustomActionsService } from './wix-custom-actions.service';

@Controller('custom-actions/wix')
@UseGuards(ScratchAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class WixCustomActionsController {
  constructor(private readonly service: WixCustomActionsService) {}

  @Post('publish-draft-posts')
  async publishDraftPosts(@Body() dtoParam: WixPublishDraftPostsDto, @Req() req: RequestWithUser) {
    const dto = dtoParam as ValidatedWixPublishDraftPostsDto;
    return this.service.publishDraftPosts(dto, userToActor(req.user));
  }
}
