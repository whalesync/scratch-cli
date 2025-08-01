import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';
import { SnapshotId } from 'src/types/ids';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { RequestWithUser } from '../auth/types';
import { SnapshotRecord } from '../remote-service/connectors/types';
import { AcceptCellValueDto } from './dto/accept-cell-value.dto';
import { AppendFieldValueDto } from './dto/append-field-value.dto';
import { BulkUpdateRecordsDto } from './dto/bulk-update-records.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { InjectFieldValueDto } from './dto/inject-field-value.dto';
import { RejectCellValueDto } from './dto/reject-cell-value.dto';
import { SetActiveRecordsFilterDto } from './dto/update-active-record-filter.dto';
import { UpdateSnapshotDto } from './dto/update-snapshot.dto';
import { Snapshot, SnapshotTableView } from './entities/snapshot.entity';
import { SnapshotEvent, SnapshotEventService, SnapshotRecordEvent } from './snapshot-event.service';
import { SnapshotService } from './snapshot.service';

@Controller('snapshot')
export class SnapshotController {
  constructor(
    private readonly service: SnapshotService,
    private readonly snapshotEventService: SnapshotEventService,
  ) {}

  @UseGuards(ScratchpadAuthGuard)
  @Post()
  async create(@Body() createSnapshotDto: CreateSnapshotDto, @Req() req: RequestWithUser): Promise<Snapshot> {
    return new Snapshot(await this.service.create(createSnapshotDto, req.user.id));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get()
  async findAll(
    @Query('connectorAccountId') connectorAccountId: string | undefined,
    @Req() req: RequestWithUser,
  ): Promise<Snapshot[]> {
    if (connectorAccountId) {
      return (await this.service.findAll(connectorAccountId, req.user.id)).map((s) => new Snapshot(s));
    }

    return (await this.service.findAllForUser(req.user.id)).map((s) => new Snapshot(s, false));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get(':id')
  async findOne(
    @Param('id') id: SnapshotId,
    @Req() req: RequestWithUser,
    @Query('includeFilters') includeFilters?: boolean,
  ): Promise<Snapshot | null> {
    const snapshot = await this.service.findOne(id, req.user.id);
    if (!snapshot) {
      return null;
    }
    return new Snapshot(snapshot, includeFilters ?? false);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: SnapshotId,
    @Body() updateSnapshotDto: UpdateSnapshotDto,
    @Req() req: RequestWithUser,
  ): Promise<Snapshot> {
    return new Snapshot(await this.service.update(id, updateSnapshotDto, req.user.id));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/publish')
  async publish(@Param('id') id: SnapshotId, @Req() req: RequestWithUser): Promise<void> {
    return this.service.publish(id, req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/download')
  async download(@Param('id') id: SnapshotId, @Req() req: RequestWithUser): Promise<void> {
    return this.service.download(id, req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: SnapshotId, @Req() req: RequestWithUser): Promise<void> {
    await this.service.delete(id, req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get(':id/tables/:tableId/records')
  async listRecords(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Query('cursor') cursor: string | undefined,
    @Query('take', new ParseIntPipe({ optional: true })) take = 100,
    @Query('viewId') viewId: string | undefined,
    @Req() req: RequestWithUser,
  ): Promise<{ records: SnapshotRecord[]; nextCursor?: string }> {
    return this.service.listRecords(snapshotId, tableId, req.user.id, cursor, take, viewId);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get(':id/tables/:tableId/records/:recordId')
  async getRecord(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Param('recordId') recordId: string,
    @Req() req: RequestWithUser,
  ): Promise<SnapshotRecord> {
    const record = await this.service.findOneRecord(snapshotId, tableId, recordId, req.user.id);
    if (!record) {
      throw new NotFoundException('Record not found');
    }
    return record;
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/records/bulk')
  @HttpCode(204)
  async bulkUpdateRecords(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Body() bulkUpdateRecordsDto: BulkUpdateRecordsDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.bulkUpdateRecords(snapshotId, tableId, bulkUpdateRecordsDto, req.user.id, 'accepted');
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/records/bulk-suggest')
  @HttpCode(204)
  async bulkUpdateRecordsSuggest(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Body() bulkUpdateRecordsDto: BulkUpdateRecordsDto,
    @Query('viewId') viewId: string | undefined,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.bulkUpdateRecords(snapshotId, tableId, bulkUpdateRecordsDto, req.user.id, 'suggested', viewId);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/accept-cell-values')
  @HttpCode(204)
  async acceptCellValues(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Body() acceptCellValueDto: AcceptCellValueDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.acceptCellValues(snapshotId, tableId, acceptCellValueDto.items, req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/reject-values')
  @HttpCode(204)
  async rejectValues(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Body() rejectCellValueDto: RejectCellValueDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.rejectValues(snapshotId, tableId, rejectCellValueDto.items, req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/clear-activate-view')
  @HttpCode(204)
  async clearActiveView(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.clearActiveView(snapshotId, tableId, req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/views')
  async listViews(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<SnapshotTableView[]> {
    return (await this.service.listViews(snapshotId, tableId, req.user.id)).map((v) => new SnapshotTableView(v));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Delete(':id/tables/:tableId/views/:viewId')
  @HttpCode(204)
  async deleteView(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Param('viewId') viewId: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.deleteView(snapshotId, tableId, viewId, req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get(':id/tables/:tableId/views/:viewId')
  async getView(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Param('viewId') viewId: string,
    @Req() req: RequestWithUser,
  ): Promise<SnapshotTableView> {
    const view = await this.service.getView(snapshotId, tableId, viewId, req.user.id);
    return new SnapshotTableView(view);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/set-active-records-filter')
  @HttpCode(204)
  async setActiveRecordsFilter(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Body() setActiveRecordsFilterDto: SetActiveRecordsFilterDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.setActiveRecordsFilter(snapshotId, tableId, setActiveRecordsFilterDto, req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/clear-active-record-filter')
  @HttpCode(204)
  async clearActiveRecordFilter(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.clearActiveRecordFilter(snapshotId, tableId, req.user.id);
  }

  /**
   * SSE endpoint to stream record changes for a snapshot table.
   * GET /snapshot/:id/tables/:tableId/records/events
   */
  @UseGuards(ScratchpadAuthGuard)
  @Sse(':id/tables/:tableId/records/events')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async subscribeRecordEvents(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<Observable<SnapshotRecordEvent>> {
    const snapshot = await this.service.findOne(snapshotId, req.user.id);

    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    return this.snapshotEventService.getRecordEvents(snapshot, tableSpec);
  }

  /**
   * SSE endpoint to stream record changes for a snapshot table.
   * GET /snapshot/:id/tables/:tableId/records/events
   */
  @UseGuards(ScratchpadAuthGuard)
  @Sse(':id/events')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async subscribeSnapshotEvents(
    @Param('id') snapshotId: SnapshotId,
    @Req() req: RequestWithUser,
  ): Promise<Observable<SnapshotEvent>> {
    const snapshot = await this.service.findOne(snapshotId, req.user.id);

    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    return this.snapshotEventService.getSnapshotEvents(snapshot);
  }

  // TODO: move this endpoint to some kind of debug controller.
  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/records/events/test')
  async sendTestRecordEvent(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<string> {
    const snapshot = await this.service.findOne(snapshotId, req.user.id);
    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
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
    this.snapshotEventService.sendRecordEvent(snapshotId, tableId, event);
    return 'event sent at ' + new Date().toISOString();
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/records/append-value')
  @HttpCode(204)
  async appendValue(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Body() appendFieldValueDto: AppendFieldValueDto,
    @Query('viewId') viewId: string | undefined,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.appendFieldValue(
      snapshotId,
      tableId,
      appendFieldValueDto.wsId,
      req.user.id,
      'suggested',
      appendFieldValueDto.columnId,
      appendFieldValueDto.value,
    );
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/records/inject-value')
  @HttpCode(204)
  async injectValue(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Body() injectFieldValueDto: InjectFieldValueDto,
    @Query('viewId') viewId: string | undefined,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.injectFieldValue(
      snapshotId,
      tableId,
      injectFieldValueDto.wsId,
      req.user.id,
      'suggested',
      injectFieldValueDto.columnId,
      injectFieldValueDto.value,
      injectFieldValueDto.targetKey,
    );
  }
}
