import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { WorkbookId } from '@spinner/shared-types';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { userToActor } from 'src/users/types';
import { CreateSyncDto } from './dtos/create-sync.dto';
import { SyncService } from './sync.service';

@Controller('workbooks/:workbookId/syncs')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  async createSync(
    @Param('workbookId') workbookId: WorkbookId,
    @Body() dto: CreateSyncDto,
    @Req() req: RequestWithUser,
  ): Promise<unknown> {
    return await this.syncService.createSync(workbookId, dto, userToActor(req.user));
  }
  @Get()
  async listSyncs(@Param('workbookId') workbookId: WorkbookId, @Req() req: RequestWithUser): Promise<unknown> {
    return await this.syncService.findAllForWorkbook(workbookId, userToActor(req.user));
  }
}
