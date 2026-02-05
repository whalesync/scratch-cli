import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type {
  DataFolderGroup,
  DataFolderPublishStatus,
  ValidatedAddTableToWorkbookDto,
  ValidatedSetContentColumnDto,
  ValidatedSetTitleColumnDto,
  ValidatedUpdateColumnSettingsDto,
  WorkbookId,
} from '@spinner/shared-types';
import {
  CreateWorkbookDto,
  PullFilesDto,
  SetContentColumnDto,
  SetTitleColumnDto,
  UpdateColumnSettingsDto,
  UpdateFolderDto,
  UpdateWorkbookDto,
} from '@spinner/shared-types';
import { Observable } from 'rxjs';
import { hasAdminToolsPermission } from 'src/auth/permissions';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { userToActor } from '../users/types';
import { DataFolderService } from './data-folder.service';
import { Workbook } from './entities';
import { SnapshotTable } from './entities/snapshot-table.entity';

import { SnapshotEvent, SnapshotEventService, SnapshotRecordEvent } from './snapshot-event.service';
import { getSnapshotTableById } from './util';
import { WorkbookService } from './workbook.service';

@Controller('workbook')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class WorkbookController {
  constructor(
    private readonly service: WorkbookService,
    private readonly snapshotEventService: SnapshotEventService,
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

  @Post(':id/add-table')
  async addTable(
    @Param('id') id: WorkbookId,
    @Body() addTableDto: ValidatedAddTableToWorkbookDto,
    @Req() req: RequestWithUser,
  ): Promise<SnapshotTable> {
    const dto = addTableDto;
    const actor = userToActor(req.user);

    // Verify the user is an admin or owner of the workbookId
    const workbook = await this.service.findOne(id, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    const createdTable = await this.service.addTableToWorkbook(id, dto, actor);
    return new SnapshotTable(createdTable);
  }

  @Patch(':workbookId/tables/:tableId/hide')
  async hideTable(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body('hidden') hidden: boolean,
    @Req() req: RequestWithUser,
  ): Promise<Workbook> {
    return new Workbook(await this.service.setTableHidden(workbookId, tableId, hidden, userToActor(req.user)));
  }

  @Delete(':workbookId/tables/:tableId')
  async deleteTable(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<Workbook> {
    return new Workbook(await this.service.deleteTable(workbookId, tableId, userToActor(req.user)));
  }

  @Post(':id/pull-files')
  async pullFiles(
    @Param('id') id: WorkbookId,
    @Body() pullDto: PullFilesDto,
    @Req() req: RequestWithUser,
  ): Promise<{ jobId: string }> {
    const dto = pullDto;
    // Support both old field name (snapshotTableIds) and new field name (dataFolderIds) for backward compatibility
    const folderIds = dto.dataFolderIds ?? dto.snapshotTableIds;
    return this.service.pullFiles(id, userToActor(req.user), folderIds);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: WorkbookId, @Req() req: RequestWithUser): Promise<void> {
    await this.service.delete(id, userToActor(req.user));
  }

  @Patch(':id/tables/:tableId/column-settings')
  @HttpCode(204)
  async updateColumnSettings(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() updateColumnSettingsDto: UpdateColumnSettingsDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    const dto = updateColumnSettingsDto as ValidatedUpdateColumnSettingsDto;
    await this.service.updateColumnSettings(workbookId, tableId, dto.columnSettings, userToActor(req.user));
  }

  @Patch(':id/tables/:tableId/title-column')
  @HttpCode(204)
  async setTitleColumn(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() setTitleColumnDto: SetTitleColumnDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    const dto = setTitleColumnDto as ValidatedSetTitleColumnDto;
    await this.service.setTitleColumn(workbookId, tableId, dto.columnId, userToActor(req.user));
  }

  @Patch(':id/tables/:tableId/content-column')
  @HttpCode(204)
  async setContentColumn(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() setContentColumnDto: SetContentColumnDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    const dto = setContentColumnDto as ValidatedSetContentColumnDto;
    await this.service.setContentColumn(workbookId, tableId, dto.columnId, userToActor(req.user));
  }

  @Post(':id/tables/:tableId/clear-active-record-filter')
  @HttpCode(204)
  async clearActiveRecordFilter(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.clearActiveRecordFilter(workbookId, tableId, userToActor(req.user));
  }

  /**
   * SSE endpoint to stream record changes for a snapshot table.
   * GET /workbook/:id/tables/:tableId/records/events
   */

  @Sse(':id/tables/:tableId/records/events')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async subscribeRecordEvents(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<Observable<SnapshotRecordEvent>> {
    const workbook = await this.service.findOne(workbookId, userToActor(req.user));

    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in workbook`);
    }

    return this.snapshotEventService.getRecordEvents(workbook, snapshotTable.id);
  }

  /**
   * SSE endpoint to stream record changes for a snapshot table.
   * GET /workbook/:id/tables/:tableId/records/events
   */

  @Sse(':id/events')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async subscribeSnapshotEvents(
    @Param('id') workbookId: WorkbookId,
    @Req() req: RequestWithUser,
  ): Promise<Observable<SnapshotEvent>> {
    const workbook = await this.service.findOne(workbookId, userToActor(req.user));

    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    return this.snapshotEventService.getSnapshotEvents(workbook);
  }

  // TODO: move this endpoint to some kind of debug controller.

  @Post(':id/tables/:tableId/records/events/test')
  async sendTestRecordEvent(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<string> {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can send test record events');
    }

    const workbook = await this.service.findOne(workbookId, userToActor(req.user));
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }
    const event: SnapshotRecordEvent = {
      type: 'record-changes',
      data: {
        tableId,
        numRecords: 1,
        changeType: 'suggested',
        source: 'agent',
      },
    };
    this.snapshotEventService.sendRecordEvent(workbookId, tableId, event);
    return 'event sent at ' + new Date().toISOString();
  }

  @Post(':id/tables/:tableId/hide-column')
  async hideColumn(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() hideColumnDto: { columnId: string },
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.hideColumn(workbookId, tableId, hideColumnDto.columnId, userToActor(req.user));
  }

  @Post(':id/tables/:tableId/unhide-column')
  async unhideColumn(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() unhideColumnDto: { columnId: string },
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.unhideColumn(workbookId, tableId, unhideColumnDto.columnId, userToActor(req.user));
  }

  @Post(':id/tables/:tableId/clear-hidden-columns')
  async clearHiddenColumns(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.clearHiddenColumns(workbookId, tableId, userToActor(req.user));
  }

  @Patch(':id/folders/:folderId')
  @HttpCode(204)
  async moveFolder(
    @Param('id') workbookId: WorkbookId,
    @Param('folderId') folderId: string,
    @Body() updateFolderDto: UpdateFolderDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    if (updateFolderDto.parentFolderId !== undefined) {
      await this.service.moveFolder(workbookId, folderId, updateFolderDto.parentFolderId, userToActor(req.user));
    }
  }

  @Post(':id/discard-changes')
  @HttpCode(204)
  async discardChanges(@Param('id') workbookId: WorkbookId, @Req() req: RequestWithUser): Promise<void> {
    await this.service.discardChanges(workbookId, userToActor(req.user));
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
