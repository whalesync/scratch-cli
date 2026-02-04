import {
  BadRequestException,
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
import type {
  DataFolder,
  DataFolderId,
  Service,
  ValidatedCreateDataFolderDto,
  ValidatedMoveDataFolderDto,
  ValidatedRenameDataFolderDto,
  WorkbookId,
} from '@spinner/shared-types';
import { CreateDataFolderDto, MoveDataFolderDto, RenameDataFolderDto } from '@spinner/shared-types';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { DbService } from '../db/db.service';
import { ScratchGitService } from '../scratch-git/scratch-git.service';
import { userToActor } from '../users/types';
import { BullEnqueuerService } from '../worker-enqueuer/bull-enqueuer.service';
import {
  FolderPublishProgress,
  PublishDataFolderPublicProgress,
} from '../worker/jobs/job-definitions/publish-data-folder.job';
import { DataFolderService } from './data-folder.service';
import { WorkbookService } from './workbook.service';

@Controller('data-folder')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class DataFolderController {
  constructor(
    private readonly dataFolderService: DataFolderService,
    private readonly workbookService: WorkbookService,
    private readonly bullEnqueuerService: BullEnqueuerService,
    private readonly scratchGitService: ScratchGitService,
    private readonly db: DbService,
  ) {}

  @Post('/create')
  async create(@Body() createDataFolderDto: CreateDataFolderDto, @Req() req: RequestWithUser): Promise<DataFolder> {
    const dto = createDataFolderDto as ValidatedCreateDataFolderDto;
    const actor = userToActor(req.user);

    // Verify the user has access to the workbook
    const workbook = await this.workbookService.findOne(dto.workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    return await this.dataFolderService.createFolder(dto, actor);
  }

  /**
   * Publish multiple data folders in a single job.
   * POST /data-folder/publish
   */
  @Post('/publish')
  async publish(
    @Body() body: { workbookId: string; dataFolderIds: string[] },
    @Req() req: RequestWithUser,
  ): Promise<{ jobId: string }> {
    const actor = userToActor(req.user);
    const workbookId = body.workbookId as WorkbookId;
    const dataFolderIds = body.dataFolderIds as DataFolderId[];

    if (!dataFolderIds || dataFolderIds.length === 0) {
      throw new BadRequestException('At least one data folder ID is required');
    }

    // Verify the user has access to the workbook
    const workbook = await this.workbookService.findOne(workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    // Verify all data folders exist and belong to this workbook
    const dataFolders: DataFolder[] = [];
    for (const folderId of dataFolderIds) {
      const dataFolder = await this.dataFolderService.findOne(folderId, actor);
      if (!dataFolder) {
        throw new NotFoundException(`Data folder ${folderId} not found`);
      }
      if (dataFolder.workbookId !== workbookId) {
        throw new BadRequestException(`Data folder ${folderId} does not belong to this workbook`);
      }
      dataFolders.push(dataFolder);
    }

    // Calculate expected counts for all folders
    const foldersProgress: FolderPublishProgress[] = [];

    for (const dataFolder of dataFolders) {
      let expectedCreates = 0;
      let expectedUpdates = 0;
      let expectedDeletes = 0;

      try {
        const diff = await this.scratchGitService.getFolderDiff(workbookId, dataFolder.name);
        for (const file of diff) {
          // Only count JSON files
          if (!file.path.endsWith('.json')) continue;

          if (file.status === 'added') {
            expectedCreates++;
          } else if (file.status === 'modified') {
            expectedUpdates++;
          } else if (file.status === 'deleted') {
            expectedDeletes++;
          }
        }
      } catch {
        // If git operations fail, continue with zero expected counts
      }

      foldersProgress.push({
        id: dataFolder.id,
        name: dataFolder.name,
        connector: (dataFolder.connectorService as Service) ?? '',
        creates: 0,
        updates: 0,
        deletes: 0,
        expectedCreates,
        expectedUpdates,
        expectedDeletes,
        status: 'pending',
      });
    }

    // Build initial public progress with all folders
    const initialPublicProgress: PublishDataFolderPublicProgress = {
      totalFilesPublished: 0,
      folders: foldersProgress,
    };

    // Enqueue the publish job with all folder IDs
    const job = await this.bullEnqueuerService.enqueuePublishDataFolderJob(
      workbookId,
      actor,
      dataFolderIds,
      initialPublicProgress,
    );

    return { jobId: job.id ?? '' };
  }

  @Get(':id')
  async findOne(@Param('id') id: DataFolderId, @Req() req: RequestWithUser): Promise<DataFolder> {
    return await this.dataFolderService.findOne(id, userToActor(req.user));
  }

  @Delete(':id')
  async delete(@Param('id') id: DataFolderId, @Req() req: RequestWithUser): Promise<void> {
    await this.dataFolderService.deleteFolder(id, userToActor(req.user));
  }

  @Patch(':id/rename')
  async rename(
    @Param('id') id: DataFolderId,
    @Body() renameDto: RenameDataFolderDto,
    @Req() req: RequestWithUser,
  ): Promise<DataFolder> {
    const dto = renameDto as ValidatedRenameDataFolderDto;
    return await this.dataFolderService.renameFolder(id, dto.name, userToActor(req.user));
  }

  @Patch(':id/move')
  async move(
    @Param('id') id: DataFolderId,
    @Body() moveDto: MoveDataFolderDto,
    @Req() req: RequestWithUser,
  ): Promise<DataFolder> {
    const dto = moveDto as ValidatedMoveDataFolderDto;
    return await this.dataFolderService.moveFolder(id, dto.parentFolderId ?? null, userToActor(req.user));
  }

  @Post(':id/files')
  async createFile(
    @Param('id') id: DataFolderId,
    @Body() body: { name: string; useTemplate?: boolean; workbookId: string },
    @Req() req: RequestWithUser,
  ) {
    return await this.dataFolderService.createFile(
      body.workbookId as WorkbookId,
      id,
      { name: body.name, useTemplate: body.useTemplate },
      userToActor(req.user),
    );
  }

  @Post(':id/publish')
  async publishSingleFolder(
    @Param('id') id: DataFolderId,
    @Body() body: { workbookId: string },
    @Req() req: RequestWithUser,
  ): Promise<{ jobId: string }> {
    const actor = userToActor(req.user);
    const workbookId = body.workbookId as WorkbookId;

    // Verify the user has access to the workbook
    const workbook = await this.workbookService.findOne(workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    // Verify the data folder exists and belongs to this workbook
    const dataFolder = await this.dataFolderService.findOne(id, actor);
    if (!dataFolder) {
      throw new NotFoundException('Data folder not found');
    }
    if (dataFolder.workbookId !== workbookId) {
      throw new BadRequestException('Data folder does not belong to this workbook');
    }

    // Enqueue the publish job with single folder as array
    const job = await this.bullEnqueuerService.enqueuePublishDataFolderJob(workbookId, actor, [id]);

    return { jobId: job.id ?? '' };
  }

  @Get(':id/schema-paths')
  async getSchemaPaths(@Param('id') id: DataFolderId, @Req() req: RequestWithUser): Promise<string[]> {
    return await this.dataFolderService.getSchemaPaths(id, userToActor(req.user));
  }
}
