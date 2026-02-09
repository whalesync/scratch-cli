import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { DataFolderGroup, DataFolderPublishStatus, WorkbookId } from '@spinner/shared-types';
import { CreateWorkbookDto, PullFilesDto, UpdateWorkbookDto } from '@spinner/shared-types';
import { ScratchAuthGuard } from '../auth/scratch-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { userToActor } from '../users/types';
import { DataFolderService } from './data-folder.service';
import { Workbook } from './entities';

import { WorkbookService } from './workbook.service';

@Controller('workbook')
@UseGuards(ScratchAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class WorkbookController {
  constructor(
    private readonly service: WorkbookService,
    private readonly dataFolderService: DataFolderService,
  ) {}

  @Post()
  async create(@Body() createWorkbookDto: CreateWorkbookDto, @Req() req: RequestWithUser): Promise<Workbook> {
    const dto = createWorkbookDto;
    return new Workbook(await this.service.create(dto, userToActor(req.user)));
  }

  @Get()
  async findAll(
    @Query('connectorAccountId') connectorAccountId: string | undefined,
    @Query('sortBy') sortBy: 'name' | 'createdAt' | 'updatedAt' | undefined,
    @Query('sortOrder') sortOrder: 'asc' | 'desc' | undefined,
    @Req() req: RequestWithUser,
  ): Promise<Workbook[]> {
    if (connectorAccountId) {
      return (
        await this.service.findAllForConnectorAccount(connectorAccountId, userToActor(req.user), sortBy, sortOrder)
      ).map((s) => new Workbook(s));
    }

    return (await this.service.findAllForUser(userToActor(req.user), sortBy, sortOrder)).map((s) => new Workbook(s));
  }

  @Get(':id')
  async findOne(@Param('id') id: WorkbookId, @Req() req: RequestWithUser): Promise<Workbook | null> {
    const workbook = await this.service.findOne(id, userToActor(req.user));
    if (!workbook) {
      return null;
    }
    return new Workbook(workbook);
  }

  @Patch(':id')
  async update(
    @Param('id') id: WorkbookId,
    @Body() updateWorkbookDto: UpdateWorkbookDto,
    @Req() req: RequestWithUser,
  ): Promise<Workbook> {
    const dto = updateWorkbookDto;
    return new Workbook(await this.service.update(id, dto, userToActor(req.user)));
  }

  @Post(':id/pull-files')
  async pullFiles(
    @Param('id') id: WorkbookId,
    @Body() pullDto: PullFilesDto,
    @Req() req: RequestWithUser,
  ): Promise<{ jobId: string }> {
    const dto = pullDto;
    return this.service.pullFiles(id, userToActor(req.user), dto.dataFolderIds);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: WorkbookId, @Req() req: RequestWithUser): Promise<void> {
    await this.service.delete(id, userToActor(req.user));
  }

  @Post(':id/discard-changes')
  @HttpCode(204)
  async discardChanges(
    @Param('id') workbookId: WorkbookId,
    @Body() body: { path?: string },
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.discardChanges(workbookId, userToActor(req.user), body?.path);
  }

  /* Start new Data Folder functions */
  @Get(':id/data-folders/list')
  async listDataFolders(@Param('id') workbookId: WorkbookId, @Req() req: RequestWithUser): Promise<DataFolderGroup[]> {
    return await this.dataFolderService.listGroupedByConnectorBases(workbookId, userToActor(req.user));
  }

  @Get(':id/data-folders/publish-status')
  async getDataFoldersPublishStatus(
    @Param('id') workbookId: WorkbookId,
    @Req() req: RequestWithUser,
  ): Promise<DataFolderPublishStatus[]> {
    return await this.dataFolderService.getPublishStatus(workbookId, userToActor(req.user));
  }
}
