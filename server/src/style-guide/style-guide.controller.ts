import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { toActor } from '../auth/types';
import { CreateStyleGuideDto } from './dto/create-style-guide.dto';
import { UpdateStyleGuideDto } from './dto/update-style-guide.dto';
import { StyleGuideService } from './style-guide.service';

@Controller('style-guides')
@UseGuards(ScratchpadAuthGuard)
export class StyleGuideController {
  constructor(private readonly styleGuideService: StyleGuideService) {}

  @Get('/download')
  download(@Query('url') url: string) {
    return this.styleGuideService.downloadResource(url);
  }

  @Post()
  create(@Body() createStyleGuideDto: CreateStyleGuideDto, @Req() req: RequestWithUser) {
    return this.styleGuideService.create(createStyleGuideDto, toActor(req.user));
  }

  @Get()
  findAll(@Req() req: RequestWithUser) {
    return this.styleGuideService.findAll(toActor(req.user));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.styleGuideService.findOne(id, toActor(req.user));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStyleGuideDto: UpdateStyleGuideDto, @Req() req: RequestWithUser) {
    return this.styleGuideService.update(id, updateStyleGuideDto, toActor(req.user));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.styleGuideService.remove(id, toActor(req.user));
  }

  @Patch(':id/update-external-resource')
  updateExternalResource(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.styleGuideService.updateExternalResource(id, toActor(req.user));
  }
}
