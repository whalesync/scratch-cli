import { Body, ClassSerializerInterceptor, Controller, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ValidatedWebflowPublishItemsDto,
  ValidatedWebflowPublishSiteDto,
  WebflowPublishItemsDto,
  WebflowPublishSiteDto,
} from '@spinner/shared-types';
import { userToActor } from 'src/users/types';
import { ScratchpadAuthGuard } from '../../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../../auth/types';
import { WebflowCustomActionsService } from './webflow-custom-actions.service';

@Controller('custom-actions/webflow')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class WebflowCustomActionsController {
  constructor(private readonly service: WebflowCustomActionsService) {}

  @Post('publish-items')
  async publishItems(@Body() dtoParam: WebflowPublishItemsDto, @Req() req: RequestWithUser) {
    const dto = dtoParam as ValidatedWebflowPublishItemsDto;
    return this.service.publishItems(dto, userToActor(req.user));
  }

  @Post('publish-site')
  async publishSite(@Body() dtoParam: WebflowPublishSiteDto, @Req() req: RequestWithUser) {
    const dto = dtoParam as ValidatedWebflowPublishSiteDto;
    return this.service.publishSite(dto, userToActor(req.user));
  }
}
