import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from '../../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../../auth/types';
import { toActor } from '../../auth/types';
import { WebflowPublishItemsDto } from './dto/publish-items.dto';
import { WebflowPublishSiteDto } from './dto/publish-site.dto';
import { WebflowCustomActionsService } from './webflow-custom-actions.service';

@Controller('custom-actions/webflow')
export class WebflowCustomActionsController {
  constructor(private readonly service: WebflowCustomActionsService) {}

  @UseGuards(ScratchpadAuthGuard)
  @Post('publish-items')
  async publishItems(@Body() dto: WebflowPublishItemsDto, @Req() req: RequestWithUser) {
    return this.service.publishItems(dto, toActor(req.user));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post('publish-site')
  async publishSite(@Body() dto: WebflowPublishSiteDto, @Req() req: RequestWithUser) {
    return this.service.publishSite(dto, toActor(req.user));
  }
}
