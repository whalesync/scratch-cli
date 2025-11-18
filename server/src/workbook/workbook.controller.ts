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
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { hasAdminToolsPermission } from 'src/auth/permissions';
import { createCsvStream } from 'src/utils/csv-stream.helper';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { toActor } from '../auth/types';
import { SnapshotRecord } from '../remote-service/connectors/types';
import type { WorkbookId } from '../types/ids';
import { AcceptCellValueDto } from './dto/accept-cell-value.dto';
import { AddTableToWorkbookDto } from './dto/add-table-to-workbook.dto';
import { BulkUpdateRecordsDto } from './dto/bulk-update-records.dto';
import { CreateWorkbookDto } from './dto/create-workbook.dto';
import { DeepFetchRecordsDto } from './dto/deep-fetch-records.dto';
import { DownloadRecordsDto } from './dto/download-records.dto';
import { ImportSuggestionsDto, ImportSuggestionsResponseDto } from './dto/import-suggestions.dto';
import { PublishSummaryDto } from './dto/publish-summary.dto';
import { RejectCellValueDto } from './dto/reject-cell-value.dto';
import { AddScratchColumnDto, RemoveScratchColumnDto } from './dto/scratch-column.dto';
import { SetPageSizeDto } from './dto/set-page-size.dto';
import { SetTitleColumnDto } from './dto/set-title-column.dto';
import { SetActiveRecordsFilterDto } from './dto/update-active-record-filter.dto';
import { UpdateColumnSettingsDto } from './dto/update-column-settings.dto';
import { UpdateWorkbookDto } from './dto/update-workbook.dto';
import { Workbook } from './entities';
import { DownloadWorkbookResult, DownloadWorkbookWithoutJobResult } from './entities/download-results.entity';
import { SnapshotTable } from './entities/snapshot-table.entity';
import { SnapshotDbService } from './snapshot-db.service';
import { SnapshotEvent, SnapshotEventService, SnapshotRecordEvent } from './snapshot-event.service';
import { getSnapshotTableById } from './util';
import { WorkbookService } from './workbook.service';

@Controller('workbook')
@UseGuards(ScratchpadAuthGuard)
export class WorkbookController {
  constructor(
    private readonly service: WorkbookService,
    private readonly snapshotEventService: SnapshotEventService,
    private readonly snapshotDbService: SnapshotDbService,
  ) {}

  @Post()
  async create(@Body() createWorkbookDto: CreateWorkbookDto, @Req() req: RequestWithUser): Promise<Workbook> {
    return new Workbook(await this.service.create(createWorkbookDto, toActor(req.user)));
  }

  @Get()
  async findAll(
    @Query('connectorAccountId') connectorAccountId: string | undefined,
    @Req() req: RequestWithUser,
  ): Promise<Workbook[]> {
    if (connectorAccountId) {
      return (await this.service.findAllForConnectorAccount(connectorAccountId, toActor(req.user))).map(
        (s) => new Workbook(s),
      );
    }

    return (await this.service.findAllForUser(toActor(req.user))).map((s) => new Workbook(s));
  }

  @Get(':id')
  async findOne(@Param('id') id: WorkbookId, @Req() req: RequestWithUser): Promise<Workbook | null> {
    const workbook = await this.service.findOne(id, toActor(req.user));
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
    return new Workbook(await this.service.update(id, updateWorkbookDto, toActor(req.user)));
  }

  @Post(':id/add-table')
  async addTable(
    @Param('id') id: WorkbookId,
    @Body() addTableDto: AddTableToWorkbookDto,
    @Req() req: RequestWithUser,
  ): Promise<SnapshotTable> {
    const actor = toActor(req.user);

    // Verify the user is an admin or owner of the workbookId
    const workbook = await this.service.findOne(id, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    const createdTable = await this.service.addTableToWorkbook(id, addTableDto, actor);
    return new SnapshotTable(createdTable);
  }

  @Patch(':workbookId/tables/:tableId/hide')
  async hideTable(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body('hidden') hidden: boolean,
    @Req() req: RequestWithUser,
  ): Promise<Workbook> {
    return new Workbook(await this.service.setTableHidden(workbookId, tableId, hidden, toActor(req.user)));
  }

  @Delete(':workbookId/tables/:tableId')
  async deleteTable(
    @Param('workbookId') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<Workbook> {
    return new Workbook(await this.service.deleteTable(workbookId, tableId, toActor(req.user)));
  }

  @Post(':id/publish')
  async publish(@Param('id') id: WorkbookId, @Req() req: RequestWithUser): Promise<void> {
    return this.service.publish(id, toActor(req.user));
  }

  @Get(':id/publish-summary')
  async getPublishSummary(@Param('id') id: WorkbookId, @Req() req: RequestWithUser): Promise<PublishSummaryDto> {
    return await this.service.getPublishSummary(id, toActor(req.user));
  }

  @Post(':id/download-without-job')
  async downloadWithoutJob(
    @Param('id') id: WorkbookId,
    @Req() req: RequestWithUser,
  ): Promise<DownloadWorkbookWithoutJobResult> {
    return this.service.downloadWithoutJob(id, toActor(req.user));
  }

  @Post(':id/download')
  async download(
    @Param('id') id: WorkbookId,
    @Body() downloadDto: DownloadRecordsDto,
    @Req() req: RequestWithUser,
  ): Promise<DownloadWorkbookResult> {
    return this.service.download(id, toActor(req.user), downloadDto.snapshotTableIds);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: WorkbookId, @Req() req: RequestWithUser): Promise<void> {
    await this.service.delete(id, toActor(req.user));
  }

  @Get(':id/tables/:tableId/records')
  async listRecords(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Query('cursor') cursor: string | undefined,
    @Query('take', new ParseIntPipe({ optional: true })) take = 100,
    @Req() req: RequestWithUser,
  ): Promise<{ records: SnapshotRecord[]; nextCursor?: string }> {
    return this.service.listRecords(workbookId, tableId, toActor(req.user), cursor, take);
  }

  @Get(':id/tables/:tableId/records/:recordId')
  async getRecord(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Param('recordId') recordId: string,
    @Req() req: RequestWithUser,
  ): Promise<SnapshotRecord> {
    const record = await this.service.findOneRecord(workbookId, tableId, recordId, toActor(req.user));
    if (!record) {
      throw new NotFoundException('Record not found');
    }
    return record;
  }

  @Post(':id/tables/:tableId/records/bulk')
  @HttpCode(204)
  async bulkUpdateRecords(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() bulkUpdateRecordsDto: BulkUpdateRecordsDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.bulkUpdateRecords(workbookId, tableId, bulkUpdateRecordsDto, toActor(req.user), 'accepted');
  }

  @Post(':id/tables/:tableId/records/bulk-suggest')
  @HttpCode(204)
  async bulkUpdateRecordsSuggest(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() bulkUpdateRecordsDto: BulkUpdateRecordsDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.bulkUpdateRecords(workbookId, tableId, bulkUpdateRecordsDto, toActor(req.user), 'suggested');
  }

  @Post(':id/tables/:tableId/import-suggestions')
  @UseInterceptors(FileInterceptor('file'))
  async importSuggestions(
    @Param('id') workbookId: WorkbookId,
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

    return await this.service.importSuggestions(workbookId, tableId, file.buffer, toActor(req.user));
  }

  @Post(':id/tables/:tableId/records/deep-fetch')
  async deepFetchRecords(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() deepFetchRecordsDto: DeepFetchRecordsDto,
    @Req() req: RequestWithUser,
  ): Promise<{ records: SnapshotRecord[]; totalCount: number }> {
    return await this.service.deepFetchRecords(
      workbookId,
      tableId,
      deepFetchRecordsDto.recordIds,
      deepFetchRecordsDto.fields || null,
      toActor(req.user),
    );
  }

  @Post(':id/tables/:tableId/accept-cell-values')
  @HttpCode(204)
  async acceptCellValues(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() acceptCellValueDto: AcceptCellValueDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.acceptCellValues(workbookId, tableId, acceptCellValueDto.items, toActor(req.user));
  }

  @Post(':id/tables/:tableId/accept-all-suggestions')
  async acceptAllSuggestions(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ recordsUpdated: number; totalChangesAccepted: number }> {
    return await this.service.acceptAllSuggestions(workbookId, tableId, toActor(req.user));
  }

  @Patch(':id/tables/:tableId/column-settings')
  @HttpCode(204)
  async updateColumnSettings(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() updateColumnSettingsDto: UpdateColumnSettingsDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.updateColumnSettings(
      workbookId,
      tableId,
      updateColumnSettingsDto.columnSettings,
      toActor(req.user),
    );
  }

  @Patch(':id/tables/:tableId/title-column')
  @HttpCode(204)
  async setTitleColumn(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() setTitleColumnDto: SetTitleColumnDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.setTitleColumn(workbookId, tableId, setTitleColumnDto.columnId, toActor(req.user));
  }

  @Post(':id/tables/:tableId/reject-values')
  @HttpCode(204)
  async rejectValues(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() rejectCellValueDto: RejectCellValueDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.rejectValues(workbookId, tableId, rejectCellValueDto.items, toActor(req.user));
  }

  @Post(':id/tables/:tableId/reject-all-suggestions')
  async rejectAllSuggestions(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ recordsRejected: number; totalChangesRejected: number }> {
    return await this.service.rejectAllSuggestions(workbookId, tableId, toActor(req.user));
  }

  @Post(':id/tables/:tableId/set-active-records-filter')
  @HttpCode(204)
  async setActiveRecordsFilter(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() setActiveRecordsFilterDto: SetActiveRecordsFilterDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.setActiveRecordsFilter(workbookId, tableId, setActiveRecordsFilterDto, toActor(req.user));
  }

  @Post(':id/tables/:tableId/clear-active-record-filter')
  @HttpCode(204)
  async clearActiveRecordFilter(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.clearActiveRecordFilter(workbookId, tableId, toActor(req.user));
  }

  @Patch(':id/tables/:tableId/page-size')
  @HttpCode(204)
  async setPageSize(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() setPageSizeDto: SetPageSizeDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.setPageSize(workbookId, tableId, setPageSizeDto.pageSize ?? null, toActor(req.user));
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
    const workbook = await this.service.findOne(workbookId, toActor(req.user));

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
    const workbook = await this.service.findOne(workbookId, toActor(req.user));

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

    const workbook = await this.service.findOne(workbookId, toActor(req.user));
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

  @Get(':id/export-as-csv')
  async exportAsCsv(
    @Param('id') workbookId: WorkbookId,
    @Query('tableId') tableId: string,
    @Query('filteredOnly') filteredOnly: string,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ): Promise<void> {
    // Verify user has access to the workbook
    const workbook = await this.service.findOne(workbookId, toActor(req.user));
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in workbook`);
    }

    try {
      // Get column names to exclude internal metadata fields and wsId
      const columnQuery = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = '${workbookId}'
        AND table_name = '${tableId}'
        AND column_name NOT IN ('wsId', '__edited_fields', '__suggested_values', '__metadata', '__dirty')
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
        await this.snapshotDbService.snapshotDb.knex(`${workbookId}.${tableId}`).update({
          __dirty: false,
          __edited_fields: {},
        });
      }

      // Set response headers
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      const filename = `${workbook.name || 'workbook'}_${tableId}.csv`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Use the CSV stream helper to stream the data
      const { stream, cleanup } = await createCsvStream({
        knex: this.snapshotDbService.snapshotDb.knex,
        schema: workbookId,
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

  @Post(':id/tables/:tableId/add-scratch-column')
  async addScratchColumn(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string, // The WS Table ID
    @Body() addScratchColumnDto: AddScratchColumnDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.addScratchColumn(workbookId, tableId, addScratchColumnDto, toActor(req.user));
  }

  @Post(':id/tables/:tableId/remove-scratch-column')
  async removeScratchColumn(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string, // The WS Table ID
    @Body() removeScratchColumnDto: RemoveScratchColumnDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.removeScratchColumn(workbookId, tableId, removeScratchColumnDto.columnId, toActor(req.user));
  }

  @Post(':id/tables/:tableId/hide-column')
  async hideColumn(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() hideColumnDto: { columnId: string },
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.hideColumn(workbookId, tableId, hideColumnDto.columnId, toActor(req.user));
  }

  @Post(':id/tables/:tableId/unhide-column')
  async unhideColumn(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Body() unhideColumnDto: { columnId: string },
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.unhideColumn(workbookId, tableId, unhideColumnDto.columnId, toActor(req.user));
  }

  @Post(':id/tables/:tableId/clear-hidden-columns')
  async clearHiddenColumns(
    @Param('id') workbookId: WorkbookId,
    @Param('tableId') tableId: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.clearHiddenColumns(workbookId, tableId, toActor(req.user));
  }
}
