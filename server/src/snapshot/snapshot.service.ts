/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConnectorAccount, Service } from '@prisma/client';
import { Response } from 'express';
import _ from 'lodash';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { SnapshotCluster } from 'src/db/cluster-types';
import { DbService } from 'src/db/db.service';
import { WSLogger } from 'src/logger';
import { PostHogService } from 'src/posthog/posthog.service';
import { DecryptedCredentials } from 'src/remote-service/connector-account/types/encrypted-credentials.interface';
import { createSnapshotId, SnapshotId } from 'src/types/ids';
import { UploadsService } from 'src/uploads/uploads.service';
import { createCsvStream } from 'src/utils/csv-stream.helper';
import { ViewConfig, ViewTableConfig } from 'src/view/types';
import { BullEnqueuerService } from 'src/worker-enqueuer/bull-enqueuer.service';
import { ConnectorAccountService } from '../remote-service/connector-account/connector-account.service';
import { Connector } from '../remote-service/connectors/connector';
import { ConnectorsService } from '../remote-service/connectors/connectors.service';
import { AnyTableSpec, TableSpecs } from '../remote-service/connectors/library/custom-spec-registry';
import { ExistingSnapshotRecord, PostgresColumnType, SnapshotRecord } from '../remote-service/connectors/types';
import { BulkUpdateRecordsDto, RecordOperation } from './dto/bulk-update-records.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { PublishSummaryDto } from './dto/publish-summary.dto';
import { SetActiveRecordsFilterDto } from './dto/update-active-record-filter.dto';
import { UpdateSnapshotDto } from './dto/update-snapshot.dto';
import { DownloadSnapshotResult, DownloadSnapshotWithouotJobResult } from './entities/download-results.entity';
import { Snapshot } from './entities/snapshot.entity';
import { SnapshotDbService } from './snapshot-db.service';
import { SnapshotEventService } from './snapshot-event.service';
import { ActiveRecordSqlFilter, SnapshotTableContext } from './types';

type SnapshotWithConnectorAccount = SnapshotCluster.Snapshot;

@Injectable()
export class SnapshotService {
  constructor(
    private readonly db: DbService,
    private readonly configService: ScratchpadConfigService,
    private readonly connectorService: ConnectorsService,
    private readonly snapshotDbService: SnapshotDbService,
    private readonly snapshotEventService: SnapshotEventService,
    private readonly posthogService: PostHogService,
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly uploadsService: UploadsService,
    private readonly bullEnqueuerService: BullEnqueuerService,
  ) {}

  async create(createSnapshotDto: CreateSnapshotDto, userId: string): Promise<SnapshotCluster.Snapshot> {
    const { connectorAccountId, tableIds } = createSnapshotDto;

    const connectorAccount = await this.connectorAccountService.findOne(connectorAccountId, userId);
    if (!connectorAccount) {
      throw new NotFoundException('Connector account not found');
    }

    // Poll the connector for the set of columns.
    // This probably could be something the user selects, which would mean we poll for it earlier and just take the
    // results back here.
    const connector = await this.connectorService.getConnector({
      service: connectorAccount.service,
      connectorAccount,
      decryptedCredentials: connectorAccount,
    });
    const tableSpecs: AnyTableSpec[] = [];
    const tableContexts: SnapshotTableContext[] = [];
    for (const tableId of tableIds) {
      tableSpecs.push(await connector.fetchTableSpec(tableId, connectorAccount));
      tableContexts.push({
        id: tableId,
        activeViewId: null,
        ignoredColumns: [],
        readOnlyColumns: [],
      });
    }

    // Create the entity in the DB.
    const newSnapshot = await this.db.client.snapshot.create({
      data: {
        id: createSnapshotId(),
        userId,
        connectorAccountId,
        name: createSnapshotDto.name,
        service: connectorAccount.service,
        tableSpecs, // Cast to any for Prisma JSON storage
        tableContexts,
      },
      include: SnapshotCluster._validator.include,
    });

    // Make a new schema and create tables to store its data.
    await this.snapshotDbService.snapshotDb.createForSnapshot(newSnapshot.id as SnapshotId, tableSpecs);

    // Start downloading in the background
    // TODO: Do this work somewhere real.
    // this.downloadSnapshotInBackground(newSnapshot).catch((error) => {
    //   WSLogger.error({
    //     source: 'SnapshotService.create',
    //     message: 'Error downloading snapshot',
    //     snapshotId: newSnapshot.id,
    //     error,
    //   });
    // });

    if (this.configService.getUseJobs()) {
      await this.bullEnqueuerService.enqueueDownloadRecordsJob(newSnapshot.id, userId);
    } else {
      // Fall back to synchronous download when jobs are not available
      this.downloadSnapshotInBackground(newSnapshot).catch((error) => {
        WSLogger.error({
          source: 'SnapshotService.create',
          message: 'Error downloading snapshot',
          snapshotId: newSnapshot.id,
          error,
        });
      });
    }

    this.posthogService.trackCreateSnapshot(userId, newSnapshot);

    return newSnapshot;
  }

  async delete(id: SnapshotId, userId: string): Promise<void> {
    const snapshot = await this.findOneWithConnectorAccount(id, userId); // Permissions

    await this.snapshotDbService.snapshotDb.cleanUpSnapshot(id);
    await this.db.client.snapshot.delete({
      where: { id },
    });

    this.posthogService.trackRemoveSnapshot(userId, snapshot);
  }

  findAll(connectorAccountId: string, userId: string): Promise<SnapshotCluster.Snapshot[]> {
    return this.db.client.snapshot.findMany({
      where: {
        connectorAccountId,
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: SnapshotCluster._validator.include,
    });
  }

  findAllForUser(userId: string): Promise<SnapshotCluster.Snapshot[]> {
    return this.db.client.snapshot.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: SnapshotCluster._validator.include,
    });
  }

  findOne(id: SnapshotId, userId: string): Promise<SnapshotCluster.Snapshot | null> {
    return this.db.client.snapshot.findFirst({
      where: { id, userId },
      include: SnapshotCluster._validator.include,
    });
  }

  private async findOneWithConnectorAccount(id: SnapshotId, userId: string): Promise<SnapshotWithConnectorAccount> {
    const snapshot = await this.db.client.snapshot.findFirst({
      where: { id, userId },
      include: SnapshotCluster._validator.include,
    });
    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }
    return snapshot;
  }

  async update(
    id: SnapshotId,
    updateSnapshotDto: UpdateSnapshotDto,
    userId: string,
  ): Promise<SnapshotCluster.Snapshot> {
    // Check that the snapshot exists and belongs to the user.
    await this.findOneWithConnectorAccount(id, userId);

    const updatedSnapshot = await this.db.client.snapshot.update({
      where: { id },
      data: updateSnapshotDto,
      include: SnapshotCluster._validator.include,
    });

    this.snapshotEventService.sendSnapshotEvent(id, { type: 'snapshot-updated', data: { source: 'user' } });

    return updatedSnapshot;
  }

  async findOneRecord(
    snapshotId: SnapshotId,
    tableId: string,
    recordId: string,
    userId: string,
  ): Promise<SnapshotRecord | null> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    return this.snapshotDbService.snapshotDb.getRecord(snapshotId, tableId, recordId);
  }

  async listRecords(
    snapshotId: SnapshotId,
    tableId: string,
    userId: string,
    cursor: string | undefined,
    take: number,
    viewId: string | undefined,
  ): Promise<{ records: SnapshotRecord[]; nextCursor?: string; count: number; filteredCount: number }> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    let viewConfig: ViewConfig | undefined = undefined;

    if (viewId) {
      const view = await this.db.client.columnView.findUnique({
        where: { id: viewId },
      });
      if (view) {
        viewConfig = view.config as ViewConfig;
      }
    }

    const activeRecordSqlFilter = (snapshot.activeRecordSqlFilter as ActiveRecordSqlFilter) || {};

    const result = await this.snapshotDbService.snapshotDb.listRecords(
      snapshotId,
      tableId,
      cursor,
      take + 1,
      viewConfig,
      tableSpec,
      activeRecordSqlFilter,
    );

    let nextCursor: string | undefined;
    if (result.records.length === take + 1) {
      const nextRecord = result.records.pop();
      nextCursor = nextRecord!.id.wsId;
    }

    return {
      records: result.records,
      nextCursor,
      count: result.count,
      filteredCount: result.filteredCount,
    };
  }

  async listRecordsForAi(
    snapshotId: SnapshotId,
    tableId: string,
    userId: string,
    cursor: string | undefined,
    take: number,
    viewId: string | undefined,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    readFocus?: Array<{ recordWsId: string; columnWsId: string }>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    writeFocus?: Array<{ recordWsId: string; columnWsId: string }>,
  ): Promise<{ records: SnapshotRecord[]; nextCursor?: string; count: number; filteredCount: number }> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    let viewConfig: ViewConfig | undefined = undefined;

    if (viewId) {
      const view = await this.db.client.columnView.findUnique({
        where: { id: viewId },
      });
      if (view) {
        viewConfig = view.config as ViewConfig;
      }
    }

    const activeRecordSqlFilter = (snapshot.activeRecordSqlFilter as ActiveRecordSqlFilter) || {};

    const result = await this.snapshotDbService.snapshotDb.listRecords(
      snapshotId,
      tableId,
      cursor,
      take + 1,
      viewConfig,
      tableSpec,
      activeRecordSqlFilter,
    );

    let nextCursor: string | undefined;
    if (result.records.length === take + 1) {
      const nextRecord = result.records.pop();
      nextCursor = nextRecord!.id.wsId;
    }

    return {
      records: result.records,
      nextCursor,
      count: result.count,
      filteredCount: result.filteredCount,
    };
  }

  async bulkUpdateRecords(
    snapshotId: SnapshotId,
    tableId: string,
    dto: BulkUpdateRecordsDto,
    userId: string,
    type: 'accepted' | 'suggested',
    viewId?: string,
  ): Promise<void> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    let viewConfig: ViewConfig | undefined = undefined;

    // Only apply view filtering for suggested updates
    if (type === 'suggested' && viewId) {
      const view = await this.db.client.columnView.findUnique({
        where: { id: viewId },
      });
      if (view) {
        viewConfig = view.config as ViewConfig;
      }
    }

    // Filter operations based on view if provided
    const filteredOps =
      type === 'suggested' && viewConfig
        ? this.filterOperationsByView(dto.ops, viewConfig, tableId, tableSpec)
        : dto.ops;

    this.validateBulkUpdateOps(filteredOps, tableSpec);

    this.snapshotEventService.sendRecordEvent(snapshotId, tableId, {
      type: 'record-changes',
      data: {
        tableId,
        numRecords: filteredOps.length,
        changeType: type,
        source: type === 'suggested' ? 'agent' : 'user',
      },
    });

    return this.snapshotDbService.snapshotDb.bulkUpdateRecords(snapshotId, tableId, filteredOps, type);
  }

  async deepFetchRecords(
    snapshotId: SnapshotId,
    tableId: string,
    recordIds: string[],
    fields: string[] | null,
    userId: string,
  ): Promise<{ records: SnapshotRecord[]; totalCount: number }> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    if (!snapshot.connectorAccount) {
      throw new BadRequestException('Cannot deep fetch records for connectorless snapshots');
    }

    const connector = await this.connectorService.getConnector({
      service: snapshot.connectorAccount.service,
      connectorAccount: snapshot.connectorAccount,
      decryptedCredentials: null,
    });

    // Check if the connector supports deep fetch
    if (!connector.downloadRecordDeep) {
      throw new BadRequestException(
        `Connector for service ${snapshot.connectorAccount.service} does not support deep record fetching`,
      );
    }

    // Fetch existing records from the database
    const existingRecords = await this.snapshotDbService.snapshotDb.getRecordsByIds(snapshotId, tableId, recordIds);

    const records: SnapshotRecord[] = [];
    let totalCount = 0;

    // Process records one at a time
    for (const recordId of recordIds) {
      try {
        // Find the existing record for this recordId
        const existingRecord = existingRecords.find((r) => r.id.wsId === recordId);
        if (!existingRecord) {
          WSLogger.error({
            source: 'SnapshotService.deepFetchRecords',
            message: 'Existing record not found',
            snapshotId,
            tableId,
            recordId,
          });
          continue;
        }

        await connector.downloadRecordDeep(
          tableSpec,
          existingRecord as ExistingSnapshotRecord,
          fields,
          async (connectorRecords) => {
            // Upsert the records as they come back, similar to regular download
            await this.snapshotDbService.snapshotDb.upsertRecords(
              snapshot.id as SnapshotId,
              tableSpec,
              connectorRecords,
            );
            totalCount += connectorRecords.length;

            // Convert ConnectorRecord to SnapshotRecord for response
            for (const connectorRecord of connectorRecords) {
              records.push({
                id: {
                  wsId: connectorRecord.id, // Use the remote ID as wsId for now
                  remoteId: connectorRecord.id,
                },
                fields: connectorRecord.fields,
                __edited_fields: {},
                __suggested_values: {},
                __dirty: false,
              } as SnapshotRecord);
            }
          },
          snapshot.connectorAccount,
        );
      } catch (error) {
        WSLogger.error({
          source: 'SnapshotService.deepFetchRecords',
          message: 'Failed to deep fetch record',
          snapshotId,
          tableId,
          recordId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next record on error
      }
    }

    return { records, totalCount };
  }

  private filterOperationsByView(
    ops: RecordOperation[],
    viewConfig: ViewConfig,
    tableId: string,
    tableSpec: AnyTableSpec,
  ): RecordOperation[] {
    const tableViewConfig = viewConfig[tableId];
    if (!tableViewConfig) {
      return ops; // No view config for this table, return all operations
    }

    return ops.filter((op) => {
      // For create operations, only filter by column visibility
      if (op.op === 'create') {
        return this.isCreateOperationAllowed(op, tableViewConfig, tableSpec);
      }

      // For update operations, filter by both record and column visibility
      if (op.op === 'update') {
        return this.isUpdateOperationAllowed(op, tableViewConfig, tableSpec);
      }

      // For delete operations, only filter by record visibility
      if (op.op === 'delete') {
        return this.isDeleteOperationAllowed(op, tableViewConfig);
      }

      // For undelete operations, only filter by record visibility
      if (op.op === 'undelete') {
        return this.isDeleteOperationAllowed(op, tableViewConfig);
      }

      return true; // Allow other operations
    });
  }

  private isCreateOperationAllowed(
    op: RecordOperation,
    tableViewConfig: ViewTableConfig,
    tableSpec: AnyTableSpec,
  ): boolean {
    // For create operations, we only need to check if the columns being set are visible
    if (op.op !== 'create' || !op.data) return true;

    const visibleColumns = this.getVisibleColumns(tableViewConfig, tableSpec);
    const requestedColumns = Object.keys(op.data);

    // Check if all requested columns are visible
    return requestedColumns.every((column) => visibleColumns.includes(column));
  }

  private isUpdateOperationAllowed(
    op: RecordOperation,
    tableViewConfig: ViewTableConfig,
    tableSpec: AnyTableSpec,
  ): boolean {
    // TODO: Record filtering moved to different entity - temporarily allow all operations
    // First check if the record is visible
    // if (op.op !== 'update' || !this.isRecordVisible(op.wsId, tableViewConfig)) {
    //   return false;
    // }

    // Then check if the columns being updated are visible
    if (op.op !== 'update' || !op.data) return true;

    const visibleColumns = this.getVisibleColumns(tableViewConfig, tableSpec);
    const requestedColumns = Object.keys(op.data);

    // Check if all requested columns are visible
    return requestedColumns.every((column) => visibleColumns.includes(column));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private isDeleteOperationAllowed(op: RecordOperation, tableViewConfig: ViewTableConfig): boolean {
    // TODO: Record filtering moved to different entity - temporarily allow all operations
    // For delete operations, we only need to check if the record is visible
    // if (op.op !== 'delete') return true;
    // return this.isRecordVisible(op.wsId, tableViewConfig);
    return true;
  }

  private getVisibleColumns(tableViewConfig: ViewTableConfig, tableSpec: AnyTableSpec): string[] {
    const allColumns = tableSpec.columns.map((c) => c.id.wsId);

    // Remove hidden columns from the set of all columns
    const hiddenColumns = tableViewConfig.columns?.filter((c) => c.hidden === true).map((c) => c.wsId) ?? [];
    return allColumns.filter((col) => !hiddenColumns.includes(col));
  }

  async acceptCellValues(
    snapshotId: SnapshotId,
    tableId: string,
    items: { wsId: string; columnId: string }[],
    userId: string,
  ): Promise<void> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    // Validate that all columns exist in the table spec
    const columnMap = new Map(tableSpec.columns.map((c) => [c.id.wsId, c]));
    for (const item of items) {
      const columnSpec = columnMap.get(item.columnId);
      if (!columnSpec) {
        throw new NotFoundException(`Column '${item.columnId}' not found in table`);
      }
    }

    await this.snapshotDbService.snapshotDb.acceptCellValues(snapshotId, tableId, items, tableSpec);

    // Count unique wsId values in the items list
    const uniqueWsIds = new Set(items.map((item) => item.wsId));
    const uniqueRecordCount = uniqueWsIds.size;

    this.snapshotEventService.sendRecordEvent(snapshotId, tableId, {
      type: 'record-changes',
      data: {
        tableId,
        numRecords: uniqueRecordCount,
        changeType: 'accepted',
        source: 'user',
      },
    });
  }

  async rejectValues(
    snapshotId: SnapshotId,
    tableId: string,
    items: { wsId: string; columnId: string }[],
    userId: string,
  ): Promise<void> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    // Validate that all columns exist in the table spec
    const columnMap = new Map(tableSpec.columns.map((c) => [c.id.wsId, c]));
    for (const item of items) {
      const columnSpec = columnMap.get(item.columnId);
      if (!columnSpec) {
        throw new NotFoundException(`Column '${item.columnId}' not found in table`);
      }
    }

    // Count unique wsId values in the items list
    const uniqueWsIds = new Set(items.map((item) => item.wsId));
    const uniqueRecordCount = uniqueWsIds.size;

    await this.snapshotDbService.snapshotDb.rejectValues(snapshotId, tableId, items);

    this.snapshotEventService.sendRecordEvent(snapshotId, tableId, {
      type: 'record-changes',
      data: {
        tableId,
        numRecords: uniqueRecordCount,
        changeType: 'rejected',
        source: 'user',
      },
    });
  }

  async acceptAllSuggestions(
    snapshotId: SnapshotId,
    tableId: string,
    userId: string,
    viewId?: string,
  ): Promise<{ recordsUpdated: number; totalChangesAccepted: number }> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    let viewConfig: ViewConfig | undefined = undefined;

    if (viewId) {
      const view = await this.db.client.columnView.findUnique({
        where: { id: viewId },
      });
      if (view) {
        viewConfig = view.config as ViewConfig;
      }
    }

    // get all of the records for the table with suggestions and build a list of items to accept
    const records = await this.snapshotDbService.snapshotDb.listRecords(
      snapshotId,
      tableId,
      undefined,
      10000,
      viewConfig,
    );
    const { allSuggestions, recordsWithSuggestions } = this.extractSuggestions(records.records);

    await this.acceptCellValues(snapshotId, tableId, allSuggestions, userId);

    this.snapshotEventService.sendRecordEvent(snapshotId, tableId, {
      type: 'record-changes',
      data: {
        tableId,
        numRecords: recordsWithSuggestions.length,
        changeType: 'accepted',
        source: 'user',
      },
    });

    return {
      recordsUpdated: recordsWithSuggestions.length,
      totalChangesAccepted: allSuggestions.length,
    };
  }

  private extractSuggestions(records: SnapshotRecord[]) {
    // ignore deleted records
    const recordsWithSuggestions = records.filter(
      (r) =>
        !r.__edited_fields.__deleted &&
        Object.keys(r.__suggested_values).filter((k) => !k.startsWith('__') && k !== 'id').length > 0,
    );

    const allSuggestions = _.flatten(
      recordsWithSuggestions.map((r) => {
        return Object.keys(r.__suggested_values)
          .filter((k) => !k.startsWith('__') && k !== 'id') // no special fields
          .map((k) => {
            return { wsId: r.id.wsId, columnId: k };
          });
      }),
    );
    return { allSuggestions, recordsWithSuggestions };
  }

  async rejectAllSuggestions(
    snapshotId: SnapshotId,
    tableId: string,
    userId: string,
    viewId?: string,
  ): Promise<{ recordsRejected: number; totalChangesRejected: number }> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    let viewConfig: ViewConfig | undefined = undefined;

    if (viewId) {
      const view = await this.db.client.columnView.findUnique({
        where: { id: viewId },
      });
      if (view) {
        viewConfig = view.config as ViewConfig;
      }
    }

    // get all of the records for the table with suggestions and build a list of items to reject
    const records = await this.snapshotDbService.snapshotDb.listRecords(
      snapshotId,
      tableId,
      undefined,
      10000,
      viewConfig,
    );
    const { allSuggestions, recordsWithSuggestions } = this.extractSuggestions(records.records);

    await this.rejectValues(snapshotId, tableId, allSuggestions, userId);

    this.snapshotEventService.sendRecordEvent(snapshotId, tableId, {
      type: 'record-changes',
      data: {
        tableId,
        numRecords: recordsWithSuggestions.length,
        changeType: 'rejected',
        source: 'user',
      },
    });

    return {
      recordsRejected: recordsWithSuggestions.length,
      totalChangesRejected: allSuggestions.length,
    };
  }

  private validateBulkUpdateOps(ops: RecordOperation[], tableSpec: AnyTableSpec) {
    const errors: { wsId?: string; field: string; message: string }[] = [];
    const numericRegex = /^-?\d+(\.\d+)?$/;

    const columnMap = new Map(tableSpec.columns.map((c) => [c.id.wsId, c]));

    for (const op of ops) {
      if (op.op === 'create' || op.op === 'update') {
        if (!op.data) {
          continue;
        }

        for (const [field, value] of Object.entries(op.data)) {
          const columnSpec = columnMap.get(field);

          if (field !== 'id' && !columnSpec) {
            errors.push({
              wsId: 'wsId' in op ? op.wsId : undefined,
              field,
              message: `Field '${field}' not found in table`,
            });
            continue;
          }

          if (columnSpec?.pgType === PostgresColumnType.NUMERIC) {
            if (value !== null && typeof value !== 'number' && typeof value !== 'string') {
              errors.push({
                wsId: 'wsId' in op ? op.wsId : undefined,
                field,
                message: `Invalid input for numeric field: complex object received.`,
              });
              continue;
            }

            if (value !== null && !numericRegex.test(String(value))) {
              errors.push({
                wsId: 'wsId' in op ? op.wsId : undefined,
                field,
                message: `Invalid input syntax for type numeric: "${value}"`,
              });
            }
          }
        }
      }
    }
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Invalid input for one or more fields.',
        errors,
      });
    }
  }

  async downloadWithoutJob(id: SnapshotId, userId: string): Promise<DownloadSnapshotWithouotJobResult> {
    const snapshot = await this.findOneWithConnectorAccount(id, userId);

    return this.downloadSnapshotInBackground(snapshot);
  }

  async download(id: SnapshotId, userId: string): Promise<DownloadSnapshotResult> {
    if (!this.configService.getUseJobs()) {
      // Fall back to synchronous download when jobs are not available
      await this.downloadWithoutJob(id, userId);
      return {
        jobId: 'sync-download', // Use a placeholder ID for synchronous downloads
      };
    }
    const job = await this.bullEnqueuerService.enqueueDownloadRecordsJob(id, userId);
    return {
      jobId: job.id as string,
    };
  }

  private async downloadSnapshotInBackground(
    snapshot: SnapshotWithConnectorAccount,
  ): Promise<DownloadSnapshotWithouotJobResult> {
    if (!snapshot.connectorAccount) {
      throw new Error('Snapshot does not have a connector account');
    }
    // need a full connector account object with decoded credentials
    const connectorAccount = await this.connectorAccountService.findOne(
      snapshot.connectorAccount.id,
      snapshot.connectorAccount.userId,
    );
    const connector = await this.connectorService.getConnector({
      service: snapshot.connectorAccount.service,
      connectorAccount,
      decryptedCredentials: connectorAccount,
    });
    const tableSpecs = snapshot.tableSpecs as AnyTableSpec[];
    let totalCount = 0;
    const tables: { id: string; name: string; records: number }[] = [];
    for (const tableSpec of tableSpecs) {
      WSLogger.debug({
        source: 'SnapshotService',
        message: 'Downloading records',
        tableId: tableSpec.id.wsId,
        snapshotId: snapshot.id,
      });

      await connector.downloadTableRecords(
        tableSpec,
        async (params) => {
          const { records } = params;
          await this.snapshotDbService.snapshotDb.upsertRecords(snapshot.id as SnapshotId, tableSpec, records);
          totalCount += records.length;
          tables.push({
            id: tableSpec.id.wsId,
            name: tableSpec.name,
            records: records.length,
          });
        },
        connectorAccount,
        {
          publicProgress: {},
          jobProgress: {},
          connectorProgress: {},
        },
      );
    }

    WSLogger.debug({
      source: 'SnapshotService',
      message: 'Done downloading snapshot',
      snapshotId: snapshot.id,
      recordsDownloaded: totalCount,
      tablesDownloaded: tables.length,
    });

    return {
      totalRecords: totalCount,
      tables,
    };
  }

  async publish(id: SnapshotId, userId: string): Promise<void> {
    const snapshot = await this.findOneWithConnectorAccount(id, userId);

    // if (!snapshot.connectorAccount) {
    //   throw new BadRequestException('Cannot publish connectorless snapshots');
    // }

    // TODO: Do this work somewhere real.
    // For now it's running synchronously, but could also be done in the background.
    await this.publishSnapshot(snapshot);

    this.posthogService.trackPublishSnapshot(userId, snapshot);
  }

  async getPublishSummary(id: SnapshotId, userId: string): Promise<PublishSummaryDto> {
    const snapshot = await this.findOneWithConnectorAccount(id, userId);

    // if (!snapshot.connectorAccount) {
    //   throw new BadRequestException('Cannot get publish summary for connectorless snapshots');
    // }

    const tableSpecs = snapshot.tableSpecs as AnyTableSpec[];

    const summary: PublishSummaryDto = {
      deletes: [],
      updates: [],
      creates: [],
    };

    for (const tableSpec of tableSpecs) {
      // Get records to be deleted
      const deletedRecords = await this.getRecordsForOperation(snapshot.id as SnapshotId, tableSpec, 'delete', false);
      if (deletedRecords.length > 0) {
        summary.deletes.push({
          tableId: tableSpec.id.wsId,
          tableName: tableSpec.name,
          records: deletedRecords.map((record) => ({
            wsId: record.id.wsId,
            title: this.getRecordTitle(record, tableSpec),
          })),
        });
      }

      // Get records to be updated
      const updatedRecords = await this.getRecordsForOperation(snapshot.id as SnapshotId, tableSpec, 'update', false);
      if (updatedRecords.length > 0) {
        summary.updates.push({
          tableId: tableSpec.id.wsId,
          tableName: tableSpec.name,
          records: updatedRecords.map((record) => ({
            wsId: record.id.wsId,
            title: this.getRecordTitle(record, tableSpec),
            changes: this.getRecordChanges(record, tableSpec),
          })),
        });
      }

      // Get count of records to be created
      const createdRecords = await this.getRecordsForOperation(snapshot.id as SnapshotId, tableSpec, 'create', false);
      if (createdRecords.length > 0) {
        summary.creates.push({
          tableId: tableSpec.id.wsId,
          tableName: tableSpec.name,
          count: createdRecords.length,
        });
      }
    }

    return summary;
  }

  private async publishSnapshot(snapshot: SnapshotWithConnectorAccount): Promise<void> {
    // need a full connector account object with decoded credentials
    // if (!snapshot.connectorAccount) {
    //   throw new Error('Snapshot does not have a connector account');
    // }
    const connectorAccount: (ConnectorAccount & DecryptedCredentials) | null = snapshot.connectorAccount
      ? await this.connectorAccountService.findOne(snapshot.connectorAccount.id, snapshot.connectorAccount.userId)
      : null;
    const connector = await this.connectorService.getConnector({
      service: snapshot.service as Service,
      connectorAccount: connectorAccount,
      decryptedCredentials: connectorAccount,
    });
    const tableSpecs = snapshot.tableSpecs as AnyTableSpec[];

    // First create everything.
    for (const tableSpec of tableSpecs) {
      await this.publishCreatesToTable(snapshot, connector, tableSpec);
    }

    // Then apply updates since it might depend on the created IDs, and clear out FKs to the deleted records.
    for (const tableSpec of tableSpecs) {
      await this.publishUpdatesToTable(snapshot, connector, tableSpec);
    }

    // Finally the deletes since hopefully nothing references them any more.
    for (const tableSpec of tableSpecs) {
      await this.publishDeletesToTable(snapshot, connector, tableSpec);
    }

    WSLogger.debug({
      source: 'SnapshotService.publishSnapshot',
      message: 'Done publishing snapshot',
      snapshotId: snapshot.id,
    });
  }

  private async publishCreatesToTable<S extends Service>(
    snapshot: SnapshotWithConnectorAccount,
    connector: Connector<S>,
    tableSpec: TableSpecs[S],
  ): Promise<void> {
    const connectorAccount = snapshot.connectorAccount;
    // if (!connectorAccount) {
    //   throw new BadRequestException('Cannot publish creates to connectorless snapshots');
    // }
    await this.snapshotDbService.snapshotDb.forAllDirtyRecords(
      snapshot.id as SnapshotId,
      tableSpec.id.wsId,
      'create',
      connector.getBatchSize('create'),
      async (records) => {
        const sanitizedRecords = records
          .map((record) => filterToOnlyEditedKnownFields(record, tableSpec))
          .map((r) => ({ wsId: r.id.wsId, fields: r.fields }));

        const returnedRecords = await connector.createRecords(tableSpec, sanitizedRecords, connectorAccount);
        // Save the created IDs.
        await this.snapshotDbService.snapshotDb.updateRemoteIds(snapshot.id as SnapshotId, tableSpec, returnedRecords);
      },
      true,
    );
  }

  private async publishUpdatesToTable<S extends Service>(
    snapshot: SnapshotWithConnectorAccount,
    connector: Connector<S>,
    tableSpec: TableSpecs[S],
  ): Promise<void> {
    // Then apply updates since it might depend on the created IDs, and clear out FKs to the deleted records.
    const connectorAccount = snapshot.connectorAccount;
    // if (!connectorAccount) {
    //   throw new BadRequestException('Cannot publish updates to connectorless snapshots');
    // }

    await this.snapshotDbService.snapshotDb.forAllDirtyRecords(
      snapshot.id as SnapshotId,
      tableSpec.id.wsId,
      'update',
      connector.getBatchSize('update'),
      async (records) => {
        const sanitizedRecords = records.map((record) =>
          connector.sanitizeRecordForUpdate(record as ExistingSnapshotRecord, tableSpec),
        );
        await connector.updateRecords(tableSpec, sanitizedRecords, connectorAccount);
      },
      true,
    );
  }

  private async publishDeletesToTable<S extends Service>(
    snapshot: SnapshotWithConnectorAccount,
    connector: Connector<S>,
    tableSpec: TableSpecs[S],
  ): Promise<void> {
    // Finally the deletes since hopefully nothing references them.
    const connectorAccount = snapshot.connectorAccount;
    // if (!connectorAccount) {
    //   throw new BadRequestException('Cannot publish deletes to connectorless snapshots');
    // }
    await this.snapshotDbService.snapshotDb.forAllDirtyRecords(
      snapshot.id as SnapshotId,
      tableSpec.id.wsId,
      'delete',
      connector.getBatchSize('delete'),
      async (records) => {
        const recordIds = records
          .filter((r) => !!r.id.remoteId)
          .map((r) => ({ wsId: r.id.wsId, remoteId: r.id.remoteId! }));

        await connector.deleteRecords(tableSpec, recordIds, connectorAccount);

        // Remove them from the snapshot.
        await this.snapshotDbService.snapshotDb.deleteRecords(
          snapshot.id as SnapshotId,
          tableSpec,
          records.map((r) => r.id.wsId),
        );
      },
      true,
    );
  }

  async clearActiveView(snapshotId: SnapshotId, tableId: string, userId: string): Promise<void> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    const contexts = snapshot.tableContexts as SnapshotTableContext[];

    const tableContext = contexts.find((c) => c.id.wsId === tableId);
    if (tableContext) {
      // set the active ID
      tableContext.activeViewId = null;

      await this.db.client.snapshot.update({
        where: { id: snapshotId },
        data: {
          tableContexts: contexts,
        },
      });
    }
  }
  async setActiveRecordsFilter(
    snapshotId: SnapshotId,
    tableId: string,
    dto: SetActiveRecordsFilterDto,
    userId: string,
  ): Promise<void> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    // Validate SQL WHERE clause if provided
    if (dto.sqlWhereClause && dto.sqlWhereClause.trim() !== '') {
      const errorMessage = await this.snapshotDbService.snapshotDb.validateSqlFilter(
        snapshotId,
        tableId,
        dto.sqlWhereClause,
      );
      if (errorMessage) {
        throw new BadRequestException(
          `Invalid SQL WHERE clause. Please check your syntax and column names. ${errorMessage}`,
        );
      }
    }

    // Load existing activeRecordSqlFilter or create empty object
    const currentFilter = (snapshot.activeRecordSqlFilter as ActiveRecordSqlFilter) || {};

    // Update the filter for the specific table with SQL WHERE clause
    const updatedFilter = {
      ...currentFilter,
      [tableId]: dto.sqlWhereClause,
    };

    await this.db.client.snapshot.update({
      where: { id: snapshotId },
      data: {
        activeRecordSqlFilter: updatedFilter,
      },
    });

    this.snapshotEventService.sendSnapshotEvent(snapshotId, {
      type: 'filter-changed',
      data: {
        tableId,
        source: 'user',
      },
    });
  }

  async clearActiveRecordFilter(snapshotId: SnapshotId, tableId: string, userId: string): Promise<void> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    // Load existing activeRecordSqlFilter or create empty object
    const currentFilter = (snapshot.activeRecordSqlFilter as ActiveRecordSqlFilter) || {};

    // Remove the table from the filter (or set to empty string)
    const updatedFilter = {
      ...currentFilter,
      [tableId]: '',
    };

    await this.db.client.snapshot.update({
      where: { id: snapshotId },
      data: {
        activeRecordSqlFilter: updatedFilter,
      },
    });

    this.snapshotEventService.sendSnapshotEvent(snapshotId, {
      type: 'filter-changed',
      data: {
        tableId,
        source: 'user',
      },
    });
  }

  private async getRecordsForOperation(
    snapshotId: SnapshotId,
    tableSpec: AnyTableSpec,
    operation: 'create' | 'update' | 'delete',
    markAsClean: boolean,
  ): Promise<SnapshotRecord[]> {
    const records: SnapshotRecord[] = [];

    await this.snapshotDbService.snapshotDb.forAllDirtyRecords(
      snapshotId,
      tableSpec.id.wsId,
      operation,
      1000, // batch size
      async (batchRecords: SnapshotRecord[]) => {
        records.push(...batchRecords);
        return Promise.resolve();
      },
      markAsClean,
    );

    return records;
  }

  private getRecordTitle(record: SnapshotRecord, tableSpec: AnyTableSpec): string {
    // Try to find a title field - look for common title field names
    const titleFields = ['title', 'name', 'displayName', 'label'];

    for (const titleField of titleFields) {
      const column = tableSpec.columns.find((col) => col.id.wsId === titleField);
      if (column && record.fields[titleField]) {
        const value = record.fields[titleField];
        if (typeof value === 'string') {
          return value.length > 50 ? value.substring(0, 50) + '...' : value;
        }
      }
    }

    // If no title field found, use the first non-id text field
    for (const column of tableSpec.columns) {
      if (column.id.wsId !== 'id' && column.pgType === PostgresColumnType.TEXT && record.fields[column.id.wsId]) {
        const value = record.fields[column.id.wsId];
        if (typeof value === 'string') {
          return value.length > 50 ? value.substring(0, 50) + '...' : value;
        }
      }
    }

    // Fallback to record ID
    return record.id.wsId;
  }

  private getRecordChanges(
    record: SnapshotRecord,
    tableSpec: AnyTableSpec,
  ): Record<string, { from: unknown; to: unknown }> {
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    // Get the edited fields from the metadata
    const editedFields = record.__edited_fields;

    for (const [fieldName] of Object.entries(editedFields)) {
      // Skip special metadata fields
      if (fieldName.startsWith('__')) {
        continue;
      }

      // Find the column spec for this field
      const column = tableSpec.columns.find((col) => col.id.wsId === fieldName);
      if (!column) {
        continue;
      }

      // For now, we don't have access to the original values, so we'll show the current value
      // In a real implementation, you might want to store original values or fetch them
      changes[fieldName] = {
        from: 'Original value', // TODO: Get actual original value
        to: record.fields[fieldName],
      };
    }

    return changes;
  }

  /**
   * @deprecated
   */
  private async insertTemplateData(snapshotId: SnapshotId, tableId: string, sampleData: any[]): Promise<void> {
    try {
      const knex = this.snapshotDbService.snapshotDb.knex;

      // Insert each record with a generated wsId
      for (const record of sampleData) {
        const wsId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await knex(`${snapshotId}.${tableId}`).insert({
          wsId,
          ...record,
          __edited_fields: {},
          __suggested_values: {},
          __metadata: {},
          __dirty: false,
        });
      }

      console.log(`Successfully inserted ${sampleData.length} template records to ${snapshotId}.${tableId}`);
    } catch (error) {
      console.error('Error inserting template data:', error);
      throw new Error(`Failed to insert template data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  /**
   * @deprecated
   */
  async createTemplate(userId: string, scratchpaperName: string): Promise<{ snapshotId: string; tableId: string }> {
    try {
      // Create a connectorless snapshot
      const snapshotId = createSnapshotId();
      const tableId = 'content_data'; // Single table for template imports

      // Sample data for the template (same as the original CONTENT_FILE_BODY)
      const sampleData = [
        { id: '1', name: 'Sample Item', content_md: 'This is some test content', status: 'unpublished' },
      ];

      // Create table specs for the template
      const tableSpecs = [
        {
          id: { wsId: tableId, remoteId: ['-'] },
          name: scratchpaperName,
          columns: [
            {
              id: { wsId: 'id', remoteId: ['-'] },
              name: 'id',
              pgType: PostgresColumnType.TEXT,
              readonly: false,
            },
            {
              id: { wsId: 'name', remoteId: ['-'] },
              name: 'name',
              pgType: PostgresColumnType.TEXT,
              readonly: false,
            },
            {
              id: { wsId: 'content_md', remoteId: ['-'] },
              name: 'content_md',
              pgType: PostgresColumnType.TEXT,
              readonly: false,
            },
            {
              id: { wsId: 'status', remoteId: ['-'] },
              name: 'status',
              pgType: PostgresColumnType.TEXT,
              readonly: false,
            },
          ],
        },
      ] satisfies AnyTableSpec[];

      // Create the snapshot in the database
      await this.db.client.snapshot.create({
        data: {
          id: snapshotId,
          userId, // Direct user association
          connectorAccountId: null, // Connectorless snapshot
          name: scratchpaperName,
          service: Service.CSV,
          tableSpecs,
          tableContexts: [
            {
              id: { wsId: tableId, remoteId: ['-'] },
              activeViewId: null,
              ignoredColumns: [],
              readOnlyColumns: [],
            },
          ] satisfies SnapshotTableContext[],
        },
      });

      // Create the database schema and table
      await this.snapshotDbService.snapshotDb.createForSnapshot(snapshotId, tableSpecs);

      // Insert sample data using regular Knex (no streaming needed for small data)
      await this.insertTemplateData(snapshotId, tableId, sampleData);

      return { snapshotId, tableId };
    } catch (error) {
      console.error('Error creating template:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create template: ${errorMessage}`);
    }
  }

  /**
   * Export a snapshot as CSV without authentication (public endpoint)
   * Security relies on snapshot IDs being unguessable
   */
  async exportAsCsvPublic(
    snapshotId: SnapshotId,
    tableId: string,
    filteredOnly: boolean,
    res: Response,
  ): Promise<void> {
    // Get snapshot without user check
    const snapshotData = await this.db.client.snapshot.findUnique({
      where: { id: snapshotId },
      include: SnapshotCluster._validator.include,
    });

    if (!snapshotData) {
      throw new NotFoundException('Snapshot not found');
    }

    // Convert to Snapshot entity to get tables
    const snapshot = new Snapshot(snapshotData);

    // Find the table specification
    const tableSpec = snapshot.tables.find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    await this.streamCsvExport(snapshotId, tableId, snapshot, filteredOnly, res);
  }

  /**
   * Helper method to stream CSV export
   */
  private async streamCsvExport(
    snapshotId: SnapshotId,
    tableId: string,
    snapshot: Snapshot,
    filteredOnly: boolean,
    res: Response,
  ): Promise<void> {
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
      const sqlWhereClause = filteredOnly ? snapshot.activeRecordSqlFilter?.[tableId] : null;

      // Build the WHERE clause if filter should be applied and exists
      const whereClause =
        filteredOnly && sqlWhereClause && sqlWhereClause.trim() !== '' ? ` WHERE ${sqlWhereClause}` : '';

      // Clear __dirty and __edited_fields for all records being exported (only for "Export All", not filtered)
      if (!filteredOnly) {
        await this.snapshotDbService.snapshotDb.knex(`${snapshotId}.${tableId}`).update({
          __dirty: false,
          __edited_fields: {},
        });
      }

      // Set response headers
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      const filename = `${snapshot.name || 'snapshot'}_${tableId}.csv`;
      const encodedFilename = encodeURIComponent(filename);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`);

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
}

function filterToOnlyEditedKnownFields(record: SnapshotRecord, tableSpec: AnyTableSpec): SnapshotRecord {
  const editedFieldNames = tableSpec.columns
    .map((c) => c.id.wsId)
    .filter((colWsId) => !!record.__edited_fields[colWsId]);
  const editedFields = Object.fromEntries(
    Object.entries(record.fields).filter(([fieldName]) => editedFieldNames.includes(fieldName)),
  );

  return {
    ...record,
    fields: editedFields,
  };
}
