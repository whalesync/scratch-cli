import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { RequestWithUser } from '../auth/types';
import { CreateStyleGuideDto } from './dto/create-style-guide.dto';
import { UpdateStyleGuideDto } from './dto/update-style-guide.dto';
import { StyleGuideService } from './style-guide.service';

@Controller('style-guides')
@UseGuards(ScratchpadAuthGuard)
export class StyleGuideController {
  constructor(private readonly styleGuideService: StyleGuideService) {}

  @Post()
  create(@Body() createStyleGuideDto: CreateStyleGuideDto, @Req() req: RequestWithUser) {
    return this.styleGuideService.create(createStyleGuideDto, req.user.id);
  }

  @Get()
  findAll(@Req() req: RequestWithUser) {
    return this.styleGuideService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.styleGuideService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStyleGuideDto: UpdateStyleGuideDto, @Req() req: RequestWithUser) {
    return this.styleGuideService.update(id, updateStyleGuideDto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.styleGuideService.remove(id, req.user.id);
  }
}
