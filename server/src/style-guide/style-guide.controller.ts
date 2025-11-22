import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { toActor } from '../auth/types';
import { CreateStyleGuideDto, ValidatedCreateStyleGuideDto } from './dto/create-style-guide.dto';
import { UpdateStyleGuideDto } from './dto/update-style-guide.dto';
import { StyleGuideService } from './style-guide.service';

@Controller('style-guides')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class StyleGuideController {
  constructor(private readonly styleGuideService: StyleGuideService) {}

  @Get('/download')
  download(@Query('url') url: string) {
    return this.styleGuideService.downloadResource(url);
  }

  @Post()
  create(@Body() createStyleGuideDto: CreateStyleGuideDto, @Req() req: RequestWithUser) {
    const dto = createStyleGuideDto as ValidatedCreateStyleGuideDto;
    return this.styleGuideService.create(dto, toActor(req.user));
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
    const dto = updateStyleGuideDto;
    return this.styleGuideService.update(id, dto, toActor(req.user));
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
