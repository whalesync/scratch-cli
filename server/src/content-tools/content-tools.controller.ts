import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Snapshot } from 'src/snapshot/entities';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { RequestWithUser } from '../auth/types';
import { ContentToolsService } from './content-tools.service';
import { CreateContentSnapshotDto } from './dto/create-content-snapshot.dto';

@Controller('tools')
@UseGuards(ScratchpadAuthGuard)
export class ContentToolsController {
  constructor(private readonly contentToolsService: ContentToolsService) {}

  @Post('content-snapshot/create')
  async createContentSnapshot(
    @Body() createDto: CreateContentSnapshotDto,
    @Req() req: RequestWithUser,
  ): Promise<Snapshot> {
    return new Snapshot(await this.contentToolsService.createContentSnapshot(createDto, req.user.id));
  }
}
