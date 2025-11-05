import {
  BadRequestException,
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
  Res,
  Sse,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { hasAdminToolsPermission } from 'src/auth/permissions';
import { SnapshotId } from 'src/types/ids';
import { createCsvStream } from 'src/utils/csv-stream.helper';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { RequestWithUser, toActor } from '../auth/types';
import { SnapshotRecord } from '../remote-service/connectors/types';
import { AcceptCellValueDto } from './dto/accept-cell-value.dto';
import { AddTableToSnapshotDto } from './dto/add-table-to-snapshot.dto';
import { BulkUpdateRecordsDto } from './dto/bulk-update-records.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { DeepFetchRecordsDto } from './dto/deep-fetch-records.dto';
import { DownloadRecordsDto } from './dto/download-records.dto';
import { ImportSuggestionsDto, ImportSuggestionsResponseDto } from './dto/import-suggestions.dto';
import { PublishSummaryDto } from './dto/publish-summary.dto';
import { RejectCellValueDto } from './dto/reject-cell-value.dto';
import { AddScratchColumnDto, RemoveScratchColumnDto } from './dto/scratch-column.dto';
import { SetTitleColumnDto } from './dto/set-title-column.dto';
import { SetActiveRecordsFilterDto } from './dto/update-active-record-filter.dto';
import { UpdateColumnSettingsDto } from './dto/update-column-settings.dto';
import { UpdateSnapshotDto } from './dto/update-snapshot.dto';
import { DownloadSnapshotResult, DownloadSnapshotWithouotJobResult } from './entities/download-results.entity';
import { Snapshot } from './entities/snapshot.entity';
import { SnapshotDbService } from './snapshot-db.service';
import { SnapshotEvent, SnapshotEventService, SnapshotRecordEvent } from './snapshot-event.service';
import { SnapshotService } from './snapshot.service';
import { getSnapshotTableByWsId, getTableSpecByWsId } from './util';

@Controller('snapshot')
export class SnapshotController {
  constructor(
    private readonly service: SnapshotService,
    private readonly snapshotEventService: SnapshotEventService,
    private readonly snapshotDbService: SnapshotDbService,
  ) {}

  @UseGuards(ScratchpadAuthGuard)
  @Post()
  async create(@Body() createSnapshotDto: CreateSnapshotDto, @Req() req: RequestWithUser): Promise<Snapshot> {
    return new Snapshot(await this.service.create(createSnapshotDto, toActor(req.user)));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get()
  async findAll(
    @Query('connectorAccountId') connectorAccountId: string | undefined,
    @Req() req: RequestWithUser,
  ): Promise<Snapshot[]> {
    if (connectorAccountId) {
      return (await this.service.findAllForConnectorAccount(connectorAccountId, toActor(req.user))).map(
        (s) => new Snapshot(s),
      );
    }

    return (await this.service.findAllForUser(toActor(req.user))).map((s) => new Snapshot(s));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: SnapshotId, @Req() req: RequestWithUser): Promise<Snapshot | null> {
    const snapshot = await this.service.findOne(id, toActor(req.user));
    if (!snapshot) {
      return null;
    }
    return new Snapshot(snapshot);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: SnapshotId,
    @Body() updateSnapshotDto: UpdateSnapshotDto,
    @Req() req: RequestWithUser,
  ): Promise<Snapshot> {
    return new Snapshot(await this.service.update(id, updateSnapshotDto, toActor(req.user)));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/add-table')
  async addTable(
    @Param('id') id: SnapshotId,
    @Body() addTableDto: AddTableToSnapshotDto,
    @Req() req: RequestWithUser,
  ): Promise<Snapshot> {
    return new Snapshot(await this.service.addTableToSnapshot(id, addTableDto, toActor(req.user)));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Patch(':snapshotId/tables/:tableId/hide')
  async hideTable(
    @Param('snapshotId') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Body('hidden') hidden: boolean,
    @Req() req: RequestWithUser,
  ): Promise<Snapshot> {
    return new Snapshot(await this.service.setTableHidden(snapshotId, tableId, hidden, toActor(req.user)));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Delete(':snapshotId/tables/:tableId')
  async deleteTable(
    @Param('snapshotId') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<Snapshot> {
    return new Snapshot(await this.service.deleteTable(snapshotId, tableId, toActor(req.user)));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/publish')
  async publish(@Param('id') id: SnapshotId, @Req() req: RequestWithUser): Promise<void> {
    return this.service.publish(id, toActor(req.user));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get(':id/publish-summary')
  async getPublishSummary(@Param('id') id: SnapshotId, @Req() req: RequestWithUser): Promise<PublishSummaryDto> {
    return await this.service.getPublishSummary(id, toActor(req.user));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/download-without-job')
  async downloadWithoutJob(
    @Param('id') id: SnapshotId,
    @Req() req: RequestWithUser,
  ): Promise<DownloadSnapshotWithouotJobResult> {
    return this.service.downloadWithoutJob(id, toActor(req.user));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/download')
  async download(
    @Param('id') id: SnapshotId,
    @Body() downloadDto: DownloadRecordsDto,
    @Req() req: RequestWithUser,
  ): Promise<DownloadSnapshotResult> {
    return this.service.download(id, toActor(req.user), downloadDto.snapshotTableIds);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: SnapshotId, @Req() req: RequestWithUser): Promise<void> {
    await this.service.delete(id, toActor(req.user));
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
    return this.service.listRecords(snapshotId, tableId, toActor(req.user), cursor, take, viewId);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get(':id/tables/:tableId/records/:recordId')
  async getRecord(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Param('recordId') recordId: string,
    @Req() req: RequestWithUser,
  ): Promise<SnapshotRecord> {
    const record = await this.service.findOneRecord(snapshotId, tableId, recordId, toActor(req.user));
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
    await this.service.bulkUpdateRecords(snapshotId, tableId, bulkUpdateRecordsDto, toActor(req.user), 'accepted');
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
    await this.service.bulkUpdateRecords(
      snapshotId,
      tableId,
      bulkUpdateRecordsDto,
      toActor(req.user),
      'suggested',
      viewId,
    );
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/import-suggestions')
  @UseInterceptors(FileInterceptor('file'))
  async importSuggestions(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportSuggestionsDto,
    @Req() req: RequestWithUser,
  ): Promise<ImportSuggestionsResponseDto> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!file.mimetype.includes('csv') && !file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('File must be a CSV');
    }

    return await this.service.importSuggestions(snapshotId, tableId, file.buffer, toActor(req.user));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/records/deep-fetch')
  async deepFetchRecords(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Body() deepFetchRecordsDto: DeepFetchRecordsDto,
    @Req() req: RequestWithUser,
  ): Promise<{ records: SnapshotRecord[]; totalCount: number }> {
    return await this.service.deepFetchRecords(
      snapshotId,
      tableId,
      deepFetchRecordsDto.recordIds,
      deepFetchRecordsDto.fields || null,
      toActor(req.user),
    );
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
    await this.service.acceptCellValues(snapshotId, tableId, acceptCellValueDto.items, toActor(req.user));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/accept-all-suggestions')
  async acceptAllSuggestions(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Query('viewId') viewId: string | undefined,
    @Req() req: RequestWithUser,
  ): Promise<{ recordsUpdated: number; totalChangesAccepted: number }> {
    return await this.service.acceptAllSuggestions(snapshotId, tableId, toActor(req.user), viewId);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Patch(':id/tables/:tableId/column-settings')
  @HttpCode(204)
  async updateColumnSettings(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Body() updateColumnSettingsDto: UpdateColumnSettingsDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.updateColumnSettings(
      snapshotId,
      tableId,
      updateColumnSettingsDto.columnSettings,
      toActor(req.user),
    );
  }

  @UseGuards(ScratchpadAuthGuard)
  @Patch(':id/tables/:tableId/title-column')
  @HttpCode(204)
  async setTitleColumn(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Body() setTitleColumnDto: SetTitleColumnDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.setTitleColumn(snapshotId, tableId, setTitleColumnDto.columnId, toActor(req.user));
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
    await this.service.rejectValues(snapshotId, tableId, rejectCellValueDto.items, toActor(req.user));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/reject-all-suggestions')
  async rejectAllSuggestions(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Query('viewId') viewId: string | undefined,
    @Req() req: RequestWithUser,
  ): Promise<{ recordsRejected: number; totalChangesRejected: number }> {
    return await this.service.rejectAllSuggestions(snapshotId, tableId, toActor(req.user), viewId);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/clear-activate-view')
  @HttpCode(204)
  async clearActiveView(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.clearActiveView(snapshotId, tableId, toActor(req.user));
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
    await this.service.setActiveRecordsFilter(snapshotId, tableId, setActiveRecordsFilterDto, toActor(req.user));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/clear-active-record-filter')
  @HttpCode(204)
  async clearActiveRecordFilter(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.clearActiveRecordFilter(snapshotId, tableId, toActor(req.user));
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
    const snapshot = await this.service.findOne(snapshotId, toActor(req.user));

    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    const tableSpec = getTableSpecByWsId(snapshot, tableId);
    if (!tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot`);
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
    const snapshot = await this.service.findOne(snapshotId, toActor(req.user));

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
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can send test record events');
    }

    const snapshot = await this.service.findOne(snapshotId, toActor(req.user));
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
  @Get(':id/export-as-csv')
  async exportAsCsv(
    @Param('id') snapshotId: SnapshotId,
    @Query('tableId') tableId: string,
    @Query('filteredOnly') filteredOnly: string,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ): Promise<void> {
    // Verify user has access to the snapshot
    const snapshot = await this.service.findOne(snapshotId, toActor(req.user));
    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    const snapshotTable = getSnapshotTableByWsId(snapshot, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot`);
    }

    try {
      // Get column names to exclude internal metadata fields
      const columnQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = '${snapshotId}' 
        AND table_name = '${tableId}'
        AND column_name NOT IN ('__edited_fields', '__suggested_values', '__metadata', '__dirty')
        ORDER BY ordinal_position
      `;

      interface ColumnInfo {
        rows: {
          column_name: string;
        }[];
      }
      const columns = await this.snapshotDbService.snapshotDb.knex.raw<ColumnInfo>(columnQuery);
      const columnNames = columns.rows.map((row) => row.column_name);

      // Check if we should apply the SQL filter
      const shouldApplyFilter = filteredOnly === 'true';
      const sqlWhereClause = shouldApplyFilter ? snapshotTable.activeRecordSqlFilter : null;

      // Build the WHERE clause if filter should be applied and exists
      const whereClause =
        shouldApplyFilter && sqlWhereClause && sqlWhereClause.trim() !== '' ? ` WHERE ${sqlWhereClause}` : '';

      // Clear __dirty and __edited_fields for all records being exported (only for "Export All", not filtered)
      if (!shouldApplyFilter) {
        await this.snapshotDbService.snapshotDb.knex(`${snapshotId}.${tableId}`).update({
          __dirty: false,
          __edited_fields: {},
        });
      }

      // Set response headers
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      const filename = `${snapshot.name || 'snapshot'}_${tableId}.csv`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Use the CSV stream helper to stream the data
      const { stream, cleanup } = await createCsvStream({
        knex: this.snapshotDbService.snapshotDb.knex,
        schema: snapshotId,
        table: tableId,
        columnNames,
        whereClause,
      });

      stream.on('error', (e: Error) => {
        res.destroy(e);
      });

      stream.pipe(res).on('finish', () => {
        void cleanup();
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to generate CSV: ${errorMessage}`);
    }
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/add-scratch-column')
  async addScratchColumn(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string, // The WS Table ID
    @Body() addScratchColumnDto: AddScratchColumnDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.addScratchColumn(snapshotId, tableId, addScratchColumnDto, toActor(req.user));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/remove-scratch-column')
  async removeScratchColumn(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string, // The WS Table ID
    @Body() removeScratchColumnDto: RemoveScratchColumnDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.removeScratchColumn(snapshotId, tableId, removeScratchColumnDto.columnId, toActor(req.user));
  }
}
