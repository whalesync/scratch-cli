import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { DataFolderId, SyncId, WorkbookId } from '@spinner/shared-types';
import { CreateSyncDto, UpdateSyncDto, ValidateMappingDto } from '@spinner/shared-types';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { DbService } from 'src/db/db.service';
import { userToActor } from 'src/users/types';
import { BullEnqueuerService } from 'src/worker-enqueuer/bull-enqueuer.service';
import { SyncService } from './sync.service';

@Controller('workbooks/:workbookId/syncs')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly bullEnqueuerService: BullEnqueuerService,
    private readonly dbService: DbService,
  ) {}

  @Post()
  async createSync(
    @Param('workbookId') workbookId: WorkbookId,
    @Body() dto: CreateSyncDto,
    @Req() req: RequestWithUser,
  ): Promise<unknown> {
    return await this.syncService.createSync(workbookId, dto, userToActor(req.user));
  }

  @Patch(':syncId')
  async updateSync(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('syncId') syncId: SyncId,
    @Body() dto: UpdateSyncDto,
    @Req() req: RequestWithUser,
  ): Promise<unknown> {
    return await this.syncService.updateSync(workbookId, syncId, dto, userToActor(req.user));
  }
  @Get()
  async listSyncs(@Param('workbookId') workbookId: WorkbookId, @Req() req: RequestWithUser): Promise<unknown> {
    return await this.syncService.findAllForWorkbook(workbookId, userToActor(req.user));
  }

  @Post(':syncId/run')
  async runSync(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('syncId') syncId: SyncId,
    @Req() req: RequestWithUser,
  ) {
    const workbook = await this.dbService.client.workbook.findUnique({
      where: { id: workbookId },
      select: { userId: true, organizationId: true },
    });

    if (!workbook) {
      throw new NotFoundException(`Workbook ${workbookId} not found`);
    }

    const job = await this.bullEnqueuerService.enqueueSyncDataFoldersJob(workbookId, syncId, {
      userId: req.user.id,
      organizationId: req.user.organizationId ?? workbook.organizationId,
    });

    return {
      success: true,
      jobId: job.id,
      message: 'Sync job queued successfully',
    };
  }
  @Delete(':syncId')
  async deleteSync(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('syncId') syncId: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    return await this.syncService.deleteSync(workbookId, syncId as SyncId, userToActor(req.user));
  }

  @Post('validate-mapping')
  async validateMapping(
    @Param('workbookId') workbookId: WorkbookId,
    @Body() dto: ValidateMappingDto,
    @Req() req: RequestWithUser,
  ): Promise<{ valid: boolean }> {
    const valid = await this.syncService.validateFolderMapping(
      workbookId,
      dto.sourceId as DataFolderId,
      dto.destId as DataFolderId,
      dto.mapping,
      userToActor(req.user),
    );
    return { valid };
  }
}
