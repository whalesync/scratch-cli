/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConnectorAccount, Prisma, SnapshotTable } from '@prisma/client';
import { InputJsonObject } from '@prisma/client/runtime/library';
import {
  BulkUpdateRecordsDto,
  CREATED_FIELD,
  createSnapshotTableId,
  createWorkbookId,
  DELETED_FIELD,
  DIRTY_COLUMN,
  EDITED_FIELDS_COLUMN,
  ImportSuggestionsResponseDto,
  METADATA_COLUMN,
  PublishSummaryDto,
  RecordOperation,
  REMOTE_ID_COLUMN,
  SCRATCH_ID_COLUMN,
  SEEN_COLUMN,
  Service,
  SetActiveRecordsFilterDto,
  SnapshotTableId,
  SUGGESTED_FIELDS_COLUMN,
  UpdateRecordOperation,
  UpdateWorkbookDto,
  ValidatedAddScratchColumnDto,
  ValidatedAddTableToWorkbookDto,
  ValidatedCreateWorkbookDto,
  WorkbookId,
} from '@spinner/shared-types';
import type { Response } from 'express';
import _ from 'lodash';
import { AuditLogService } from 'src/audit/audit-log.service';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { SnapshotTableCluster, WorkbookCluster } from 'src/db/cluster-types';
import { DbService } from 'src/db/db.service';
import { WSLogger } from 'src/logger';
import { getPlan } from 'src/payment/plans';
import { PostHogService } from 'src/posthog/posthog.service';
import { DecryptedCredentials } from 'src/remote-service/connector-account/types/encrypted-credentials.interface';
import { exceptionForConnectorError } from 'src/remote-service/connectors/error';
import { sanitizeForColumnWsId, sanitizeForTableWsId } from 'src/remote-service/connectors/ids';
import { OnboardingService } from 'src/users/onboarding.service';
import { SubscriptionService } from 'src/users/subscription.service';
import { Actor } from 'src/users/types';
import { createCsvStream } from 'src/utils/csv-stream.helper';
import { validateWhereClause } from 'src/utils/sql-validator';
import { BullEnqueuerService } from 'src/worker-enqueuer/bull-enqueuer.service';
import { ConnectorAccountService } from '../remote-service/connector-account/connector-account.service';
import { Connector } from '../remote-service/connectors/connector';
import { ConnectorsService } from '../remote-service/connectors/connectors.service';
import { AnyTableSpec, TableSpecs } from '../remote-service/connectors/library/custom-spec-registry';
import {
  BaseColumnSpec,
  ExistingSnapshotRecord,
  PostgresColumnType,
  SnapshotRecord,
} from '../remote-service/connectors/types';
import { DownloadRecordsPublicProgress } from '../worker/jobs/job-definitions/download-records.job';
import { PublishRecordsPublicProgress } from '../worker/jobs/job-definitions/publish-records.job';
import { DownloadWorkbookResult, DownloadWorkbookWithoutJobResult } from './entities/download-results.entity';
import { DEFAULT_COLUMNS } from './snapshot-db';
import { SnapshotDbService } from './snapshot-db.service';
import { SnapshotEventService } from './snapshot-event.service';
import type { SnapshotColumnSettingsMap } from './types';
import { getSnapshotTableById, getTableSpecById } from './util';

@Injectable()
export class WorkbookService {
  constructor(
    private readonly db: DbService,
    private readonly configService: ScratchpadConfigService,
    private readonly connectorService: ConnectorsService,
    private readonly snapshotDbService: SnapshotDbService,
    private readonly snapshotEventService: SnapshotEventService,
    private readonly posthogService: PostHogService,
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly bullEnqueuerService: BullEnqueuerService,
    private readonly auditLogService: AuditLogService,
    private readonly subscriptionService: SubscriptionService,
    private readonly onboardingService: OnboardingService,
  ) {}

  async create(createWorkbookDto: ValidatedCreateWorkbookDto, actor: Actor): Promise<WorkbookCluster.Workbook> {
    const { name, tables } = createWorkbookDto;

    const workbookId = createWorkbookId();
    const tableSpecs: AnyTableSpec[] = [];
    const tableCreateInput: Prisma.SnapshotTableUncheckedCreateWithoutWorkbookInput[] = [];
    const tableSpecToIdMap = new Map<AnyTableSpec, SnapshotTableId>();

    if (tables) {
      for (const { connectorAccountId, tableId } of tables) {
        let connector: Connector<Service, any> | undefined = undefined;
        try {
          const connectorAccount = await this.connectorAccountService.findOne(connectorAccountId, actor);
          if (!connectorAccount) {
            throw new NotFoundException('Connector account not found');
          }
          connector = await this.connectorService.getConnector({
            service: connectorAccount.service as Service,
            connectorAccount,
            decryptedCredentials: connectorAccount,
          });

          // Poll the connector for the set of columns.
          // This probably could be something the user selects, which would mean we poll for it earlier and just take the
          // results back here.
          const tableSpec = await connector.fetchTableSpec(tableId);
          tableSpecs.push(tableSpec);

          const newTableId = createSnapshotTableId();
          const wsId = sanitizeForTableWsId(tableSpec.name);
          const tableName = `${newTableId}_${wsId}`;

          tableSpecToIdMap.set(tableSpec, newTableId);

          tableCreateInput.push({
            id: newTableId,
            connectorAccountId,
            connectorService: connectorAccount.service,
            tableSpec,
            columnSettings: {},
            tableName,
            version: 'v1',
            lock: 'download',
          });
        } catch (error) {
          if (connector) {
            throw exceptionForConnectorError(error, connector);
          } else {
            throw error;
          }
        }
      }
    }

    WSLogger.info({
      source: 'WorkbookService.create',
      message: 'Creating workbookId with tables',
      tableCount: tableSpecs.length,
    });

    const newWorkbook = await this.db.client.workbook.create({
      data: {
        id: workbookId,
        userId: actor.userId,
        organizationId: actor.organizationId,
        name: name ?? `New workbook`,
        snapshotTables: { create: tableCreateInput },
      },
      include: WorkbookCluster._validator.include,
    });

    WSLogger.info({
      source: 'WorkbookService.create',
      message: 'Workbook created',
      workbookId: newWorkbook.id,
      snapshotTablesCount: tableCreateInput.length,
    });

    // Make a new schema and create tables to store its data.
    await this.snapshotDbService.snapshotDb.createForWorkbook(
      newWorkbook.id as WorkbookId,
      tableSpecs,
      tableSpecToIdMap,
    );

    if (this.configService.getUseJobs()) {
      await this.bullEnqueuerService.enqueueDownloadRecordsJob(newWorkbook.id as WorkbookId, actor);
    } else {
      // Fall back to synchronous download when jobs are not available
      this.downloadAllSnapshotTablesInBackground(newWorkbook, actor).catch((error) => {
        WSLogger.error({
          source: 'WorkbookService.create',
          message: 'Error downloading workbook',
          workbookId: newWorkbook.id,
          error,
        });
      });
    }

    this.posthogService.trackCreateWorkbook(actor.userId, newWorkbook);
    await this.auditLogService.logEvent({
      actor,
      eventType: 'create',
      message: `Created workbook ${newWorkbook.name}`,
      entityId: newWorkbook.id as WorkbookId,
      context: {
        tables: tableSpecs.map((t) => t.id.wsId),
        services: tableCreateInput.map((t) => t.connectorService),
      },
    });

    return newWorkbook;
  }

  /**
   * Add a new table to an existing workbookId.
   * The table can be from a different connector/service than the original workbookId.
   */
  async addTableToWorkbook(
    workbookId: WorkbookId,
    addTableDto: ValidatedAddTableToWorkbookDto,
    actor: Actor,
    options?: { skipDownload?: boolean },
  ): Promise<SnapshotTableCluster.SnapshotTable> {
    const { service, connectorAccountId, tableId } = addTableDto;

    // 1. Verify workbookId exists, user has permission, and snapshot does not already include this table
    const workbook = await this.findOne(workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    if (await this.snapshotDbService.snapshotDb.tableExists(workbookId, addTableDto.tableId.wsId)) {
      throw new BadRequestException(`Table already exists in workbook.`);
    }

    // 2. Get connector account if provided (for services that need it)
    let connectorAccount: ConnectorAccount | null = null;
    if (connectorAccountId) {
      connectorAccount = await this.connectorAccountService.findOne(connectorAccountId, actor);
      if (!connectorAccount) {
        throw new NotFoundException('Connector account not found');
      }
      if ((connectorAccount.service as Service) !== service) {
        throw new BadRequestException('Connector account service does not match requested service');
      }
    }

    // 3. Get connector and fetch table spec
    const connector = await this.connectorService.getConnector({
      service,
      connectorAccount: connectorAccount ?? null,
      decryptedCredentials: (connectorAccount as unknown as DecryptedCredentials) ?? null,
    });

    let tableSpec: AnyTableSpec;
    try {
      tableSpec = await connector.fetchTableSpec(tableId);
    } catch (error) {
      throw exceptionForConnectorError(error, connector);
    }

    // 5. Create the snapshotTableId first
    const snapshotTableId = createSnapshotTableId();
    const snapshotDataTableName = `${snapshotTableId}_${tableSpec.slug}`;

    // 5. Create the new SnapshotTable record
    const createdSnapshotTable = await this.db.client.snapshotTable.create({
      data: {
        id: snapshotTableId,
        workbookId,
        tableName: snapshotDataTableName,
        connectorAccountId: connectorAccountId ?? null,
        connectorService: service,
        tableSpec: tableSpec,
        columnSettings: {},
        version: 'v1',
        lock: 'download',
      },
      include: {
        connectorAccount: true,
      },
    });

    // 6. Create database table in snapshot's schema
    await this.snapshotDbService.snapshotDb.addTableToWorkbook(workbookId, {
      spec: tableSpec,
      tableName: snapshotDataTableName,
    });

    // 7. Start downloading records in background for this specific table only (unless skipDownload is true)
    if (!options?.skipDownload) {
      try {
        if (this.configService.getUseJobs()) {
          await this.bullEnqueuerService.enqueueDownloadRecordsJob(workbookId, actor, [snapshotTableId]);
        }
        WSLogger.info({
          source: 'WorkbookService.addTableToWorkbook',
          message: 'Started downloading records for newly added table',
          workbookId,
          snapshotTableId,
        });
      } catch (error) {
        WSLogger.error({
          source: 'WorkbookService.addTableToWorkbook',
          message: 'Failed to start download job for newly added table',
          error,
          workbookId,
          snapshotTableId,
        });
        // Don't fail the addTable operation if download fails - table was still added successfully
      }
    }

    WSLogger.info({
      source: 'WorkbookService.addTableToSnapshot',
      message: 'Added table to workbook',
      workbookId,
      tableName: snapshotDataTableName,
      tableId: snapshotTableId,
      service,
    });

    await this.auditLogService.logEvent({
      actor,
      eventType: 'update',
      message: `Added table ${tableSpec.name} to workbook ${workbook.name}`,
      entityId: workbookId,
      context: {
        tableId: snapshotTableId,
        tableName: snapshotDataTableName,
        service,
      },
    });

    return createdSnapshotTable;
  }

  async setTableHidden(
    workbookId: WorkbookId,
    tableId: string,
    hidden: boolean,
    actor: Actor,
  ): Promise<WorkbookCluster.Workbook> {
    // 1. Verify workbook exists and user has permission
    const workbook = await this.findOne(workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    // 2. Update the SnapshotTable record
    await this.db.client.snapshotTable.updateMany({
      where: {
        workbookId,
        id: tableId,
      },
      data: {
        hidden,
      },
    });

    // 3. Fetch and return updated workbook
    const updatedWorkbook = await this.db.client.workbook.findUnique({
      where: { id: workbookId },
      include: WorkbookCluster._validator.include,
    });

    if (!updatedWorkbook) {
      throw new NotFoundException('Workbook not found after update');
    }

    await this.auditLogService.logEvent({
      actor,
      eventType: 'update',
      message: `${hidden ? 'Hide' : 'Unhide'} table in workbook ${workbook.name}`,
      entityId: workbookId,
      context: {
        tableId,
        hidden,
      },
    });

    return updatedWorkbook;
  }

  async deleteTable(workbookId: WorkbookId, tableId: string, actor: Actor): Promise<WorkbookCluster.Workbook> {
    // 1. Verify snapshot exists and user has permission
    const workbook = await this.findOne(workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    // 2. Get the table to delete
    const snapshotTable = await this.db.client.snapshotTable.findFirst({
      where: {
        workbookId,
        id: tableId,
      },
    });

    if (!snapshotTable) {
      throw new NotFoundException('Table not found in workbook');
    }

    // 3. Delete the database table from workbook's schema
    try {
      await this.snapshotDbService.snapshotDb.dropTableIfExists(workbookId, snapshotTable.tableName);
    } catch (error) {
      WSLogger.error({
        source: 'WorkbookService.deleteTable',
        message: 'Failed to drop table from database',
        error,
        workbookId,
        tableName: snapshotTable.tableName,
      });
      // Continue with deletion even if DB table drop fails
    }

    // 4. Delete the SnapshotTable record
    await this.db.client.snapshotTable.delete({
      where: {
        id: tableId,
      },
    });

    // 6. Fetch and return updated snapshot
    const updatedWorkbook = await this.db.client.workbook.findUnique({
      where: { id: workbookId },
      include: WorkbookCluster._validator.include,
    });

    if (!updatedWorkbook) {
      throw new NotFoundException('Workbook not found after deletion');
    }

    await this.auditLogService.logEvent({
      actor,
      eventType: 'delete',
      message: `Deleted table ${snapshotTable.tableName} from workbook ${workbook.name}`,
      entityId: workbookId,
      context: {
        tableId,
        tableName: snapshotTable.tableName,
      },
    });

    return updatedWorkbook;
  }

  async delete(id: WorkbookId, actor: Actor): Promise<void> {
    const workbook = await this.findOneOrThrow(id, actor); // Permissions

    await this.snapshotDbService.snapshotDb.cleanUpSnapshots(id);
    await this.db.client.workbook.delete({
      where: { id },
    });

    this.posthogService.trackRemoveWorkbook(actor.userId, workbook);
    await this.auditLogService.logEvent({
      actor,
      eventType: 'delete',
      message: `Deleted workbook ${workbook.name}`,
      entityId: workbook.id as WorkbookId,
    });
  }

  findAllForConnectorAccount(
    connectorAccountId: string,
    actor: Actor,
    sortBy: 'name' | 'createdAt' | 'updatedAt' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<WorkbookCluster.Workbook[]> {
    return this.db.client.workbook.findMany({
      where: {
        userId: actor.userId,
        snapshotTables: {
          some: {
            connectorAccountId,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: WorkbookCluster._validator.include,
    });
  }

  findAllForUser(
    actor: Actor,
    sortBy: 'name' | 'createdAt' | 'updatedAt' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<WorkbookCluster.Workbook[]> {
    return this.db.client.workbook.findMany({
      where: {
        userId: actor.userId,
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: WorkbookCluster._validator.include,
    });
  }

  findOne(id: WorkbookId, actor: Actor): Promise<WorkbookCluster.Workbook | null> {
    return this.db.client.workbook.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: WorkbookCluster._validator.include,
    });
  }

  private async findOneOrThrow(id: WorkbookId, actor: Actor): Promise<WorkbookCluster.Workbook> {
    const workbook = await this.findOne(id, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }
    return workbook;
  }

  async update(id: WorkbookId, updateWorkbookDto: UpdateWorkbookDto, actor: Actor): Promise<WorkbookCluster.Workbook> {
    // Check that the snapshot exists and belongs to the user.
    await this.findOneOrThrow(id, actor);

    const updatedWorkbook = await this.db.client.workbook.update({
      where: { id },
      data: updateWorkbookDto,
      include: WorkbookCluster._validator.include,
    });

    this.snapshotEventService.sendSnapshotEvent(id, { type: 'snapshot-updated', data: { source: 'user' } });

    await this.auditLogService.logEvent({
      actor,
      eventType: 'update',
      message: `Updated snapshot ${updatedWorkbook.name}`,
      entityId: updatedWorkbook.id as WorkbookId,
      context: {
        changes: Object.keys(updateWorkbookDto),
      },
    });

    return updatedWorkbook;
  }

  async findOneRecord(
    workbookId: WorkbookId,
    tableId: string,
    recordId: string,
    actor: Actor,
  ): Promise<SnapshotRecord | null> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    return this.snapshotDbService.snapshotDb.getRecord(workbookId, snapshotTable.tableName, recordId);
  }

  async listRecords(
    workbookId: WorkbookId,
    tableId: string,
    actor: Actor,
    skip: number | undefined,
    take: number,
    useStoredSkip: boolean = false,
  ): Promise<{
    records: SnapshotRecord[];
    count: number;
    filteredCount: number;
    skip: number;
    take: number;
  }> {
    const workbook = await this.findOneOrThrow(workbookId, actor);

    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;

    // Use stored skip if requested and no skip provided
    const effectiveSkip = useStoredSkip && skip === undefined ? (snapshotTable.currentSkip ?? 0) : (skip ?? 0);

    // Apply pageSize limit if set
    const effectiveTake = snapshotTable.pageSize !== null ? Math.min(take, snapshotTable.pageSize) : take;

    const result = await this.snapshotDbService.snapshotDb.listRecords(
      workbookId,
      snapshotTable.tableName,
      effectiveSkip,
      effectiveTake,
      tableSpec,
      snapshotTable.activeRecordSqlFilter,
      snapshotTable.hiddenColumns,
    );

    return {
      records: result.records,
      count: result.count,
      filteredCount: result.filteredCount,
      skip: result.skip,
      take: result.take,
    };
  }

  async listRecordsForAi(
    workbookId: WorkbookId,
    tableId: string,
    actor: Actor,
    cursor: string | undefined,
  ): Promise<{ records: SnapshotRecord[]; nextCursor?: string; count: number; filteredCount: number }> {
    if (cursor) {
      WSLogger.error({
        source: 'WorkbookService.listRecordsForAi',
        message: 'NOT YET IMPLEMENTED: cursor is not supported for AI pagination and is being ignored',
        workbookId,
        tableId,
        cursor,
      });
    }

    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }
    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;
    if (!tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    // For AI, use pageSize if set, otherwise use a large default (10000)
    const effectiveTake = snapshotTable.pageSize !== null ? snapshotTable.pageSize : 10000;

    const result = await this.snapshotDbService.snapshotDb.listRecords(
      workbookId,
      snapshotTable.tableName,
      0, // AI always starts from beginning
      effectiveTake,
      tableSpec,
      snapshotTable.activeRecordSqlFilter,
      snapshotTable.hiddenColumns,
    );

    return {
      records: result.records,
      nextCursor: 'Not supported, agent cannot paginate, all records visible to the user are returned',
      count: result.count,
      filteredCount: result.filteredCount,
    };
  }

  async getRecordsByIdsForAi(
    workbookId: WorkbookId,
    tableId: string,
    recordIds: string[],
    actor: Actor,
  ): Promise<{ records: SnapshotRecord[]; totalCount: number }> {
    const workbook = await this.findOneOrThrow(workbookId, actor);

    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;
    if (!tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    // Fetch the records by their IDs from the snapshot database
    const records = await this.snapshotDbService.snapshotDb.getRecordsByIds(
      workbookId,
      snapshotTable.tableName,
      recordIds,
      tableSpec,
      snapshotTable.hiddenColumns,
    );

    return {
      records,
      totalCount: records.length,
    };
  }

  async bulkUpdateRecords(
    workbookId: WorkbookId,
    tableId: string,
    dto: BulkUpdateRecordsDto,
    actor: Actor,
    type: 'accepted' | 'suggested',
  ): Promise<void> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;

    const ops = _.concat<RecordOperation>(dto.creates ?? [], dto.updates ?? [], dto.deletes ?? [], dto.undeletes ?? []);
    this.validateBulkUpdateOps(ops, tableSpec);
    await this.snapshotDbService.snapshotDb.bulkUpdateRecords(
      workbookId,
      snapshotTable.id as `snt_${string}`,
      snapshotTable.tableName,
      ops,
      type,
      tableSpec,
    );

    this.snapshotEventService.sendRecordEvent(workbookId, tableId, {
      type: 'record-changes',
      data: {
        tableId,
        numRecords: ops.length,
        changeType: type,
        source: type === 'suggested' ? 'agent' : 'user',
      },
    });

    // Update onboarding flow if AI made suggestions and user hasn't completed this step yet
    if (type === 'suggested' && actor.onboarding?.gettingStartedV1?.contentEditedWithAi?.completed === false) {
      await this.onboardingService.markStepCompleted(actor.userId, 'gettingStartedV1', 'contentEditedWithAi');
    }
  }

  async getOperationCounts(
    workbookId: WorkbookId,
    actor: Actor,
  ): Promise<{ tableId: string; creates: number; updates: number; deletes: number }[]> {
    const workbook = await this.findOneOrThrow(workbookId, actor);

    if (!workbook.snapshotTables) {
      return [];
    }

    const results = await Promise.all(
      workbook.snapshotTables.map(async (table) => {
        const counts = await this.snapshotDbService.snapshotDb.countExpectedOperations(workbookId, table.tableName);
        return {
          tableId: table.id,
          ...counts,
        };
      }),
    );

    return results;
  }

  async deepFetchRecords(
    workbookId: WorkbookId,
    tableId: string,
    recordIds: string[],
    fields: string[] | null,
    actor: Actor,
  ): Promise<{ records: SnapshotRecord[]; totalCount: number }> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }
    if (!snapshotTable.connectorAccount) {
      throw new BadRequestException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }
    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;

    const connector = await this.connectorService.getConnector({
      service: snapshotTable.connectorService as Service,
      connectorAccount: snapshotTable.connectorAccount,
      decryptedCredentials: null,
    });

    // Check if the connector supports deep fetch
    if (!connector.downloadRecordDeep) {
      throw new BadRequestException(
        `Connector for service ${snapshotTable.connectorService} does not support deep record fetching`,
      );
    }

    // Fetch existing records from the database
    const existingRecords = await this.snapshotDbService.snapshotDb.getRecordsByIds(
      workbookId,
      snapshotTable.tableName,
      recordIds,
    );

    const records: SnapshotRecord[] = [];
    let totalCount = 0;

    // Process records one at a time
    for (const recordId of recordIds) {
      try {
        // Find the existing record for this recordId
        const existingRecord = existingRecords.find((r) => r.id.wsId === recordId);
        if (!existingRecord) {
          WSLogger.error({
            source: 'WorkbookService.deepFetchRecords',
            message: 'Existing record not found',
            workbookId,
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
              workbook.id as WorkbookId,
              { spec: tableSpec, tableName: snapshotTable.tableName },
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
          snapshotTable.connectorAccount,
        );
      } catch (error) {
        WSLogger.error({
          source: 'WorkbookService.deepFetchRecords',
          message: 'Failed to deep fetch record',
          workbookId,
          tableId,
          recordId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next record on error
      }
    }

    return { records, totalCount };
  }

  async acceptCellValues(
    workbookId: WorkbookId,
    tableId: string,
    items: { wsId: string; columnId: string }[],
    actor: Actor,
  ): Promise<{ recordsUpdated: number }> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }
    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;
    if (!tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    // Validate that all columns exist in the table spec
    const columnMap = new Map(tableSpec.columns.map((c) => [c.id.wsId, c]));
    for (const item of items) {
      if (item.columnId === DELETED_FIELD || item.columnId === CREATED_FIELD) {
        continue;
      }
      const columnSpec = columnMap.get(item.columnId);
      if (!columnSpec) {
        throw new NotFoundException(`Column '${item.columnId}' not found in table`);
      }
    }

    const recordsUpdated = await this.snapshotDbService.snapshotDb.acceptCellValues(
      workbookId,
      snapshotTable.id as `snt_${string}`,
      snapshotTable.tableName,
      items,
      tableSpec,
    );

    // Count unique wsId values in the items list
    const uniqueWsIds = new Set(items.map((item) => item.wsId));
    const uniqueRecordCount = uniqueWsIds.size;

    this.snapshotEventService.sendRecordEvent(workbookId, tableId, {
      type: 'record-changes',
      data: {
        tableId,
        numRecords: uniqueRecordCount,
        changeType: 'accepted',
        source: 'user',
      },
    });

    // Update onboarding flow if user hasn't completed this step yet
    if (actor.onboarding?.gettingStartedV1?.suggestionsAccepted?.completed === false) {
      await this.onboardingService.markStepCompleted(actor.userId, 'gettingStartedV1', 'suggestionsAccepted');
    }

    return { recordsUpdated };
  }

  async rejectValues(
    workbookId: WorkbookId,
    tableId: string,
    items: { wsId: string; columnId: string }[],
    actor: Actor,
  ): Promise<{ recordsUpdated: number }> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    // Count unique wsId values in the items list
    const uniqueWsIds = new Set(items.map((item) => item.wsId));
    const uniqueRecordCount = uniqueWsIds.size;

    const recordsUpdated = await this.snapshotDbService.snapshotDb.rejectValues(
      workbookId,
      snapshotTable.tableName,
      items,
    );

    this.snapshotEventService.sendRecordEvent(workbookId, tableId, {
      type: 'record-changes',
      data: {
        tableId,
        numRecords: uniqueRecordCount,
        changeType: 'rejected',
        source: 'user',
      },
    });
    return { recordsUpdated };
  }

  async acceptAllSuggestions(
    workbookId: WorkbookId,
    tableId: string,
    actor: Actor,
  ): Promise<{ recordsUpdated: number; totalChangesAccepted: number }> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    // get all of the records for the table with suggestions and build a list of items to accept
    const records = await this.snapshotDbService.snapshotDb.listRecords(workbookId, snapshotTable.tableName, 0, 10000);
    const { allSuggestions, recordsWithSuggestions } = this.extractSuggestions(records.records);

    await this.acceptCellValues(workbookId, tableId, allSuggestions, actor);

    this.snapshotEventService.sendRecordEvent(workbookId, tableId, {
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

  async updateColumnSettings(
    workbookId: WorkbookId,
    tableId: string,
    newColumnSettings: SnapshotColumnSettingsMap,
    actor: Actor,
  ): Promise<void> {
    // Fetch snapshot once for both permission check AND getting existing columnContexts
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in workbook ${workbookId}`);
    }

    const existingSettings = (snapshotTable.columnSettings ?? {}) as SnapshotColumnSettingsMap;

    await this.db.client.snapshotTable.update({
      where: { id: snapshotTable.id },
      data: {
        columnSettings: {
          ...existingSettings,
          ...newColumnSettings,
        },
      },
    });
  }

  private extractSuggestions(records: SnapshotRecord[]) {
    // ignore deleted records
    const recordsWithSuggestions = records.filter(
      (r) =>
        !r.__edited_fields.__deleted &&
        Object.keys(r.__suggested_values).filter(
          (k) => k === DELETED_FIELD || k === CREATED_FIELD || (!k.startsWith('__') && k !== 'id'),
        ).length > 0,
    );

    const allSuggestions = _.flatten(
      recordsWithSuggestions.map((r) => {
        return Object.keys(r.__suggested_values)
          .filter((k) => k === DELETED_FIELD || k === CREATED_FIELD || (!k.startsWith('__') && k !== 'id')) // no special fields
          .map((k) => {
            return { wsId: r.id.wsId, columnId: k };
          });
      }),
    );
    return { allSuggestions, recordsWithSuggestions };
  }

  async rejectAllSuggestions(
    workbookId: WorkbookId,
    tableId: string,
    actor: Actor,
  ): Promise<{ recordsRejected: number; totalChangesRejected: number }> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    // get all of the records for the table with suggestions and build a list of items to reject
    const records = await this.snapshotDbService.snapshotDb.listRecords(workbookId, snapshotTable.tableName, 0, 10000);
    const { allSuggestions, recordsWithSuggestions } = this.extractSuggestions(records.records);

    await this.rejectValues(workbookId, tableId, allSuggestions, actor);

    this.snapshotEventService.sendRecordEvent(workbookId, tableId, {
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

    if (ops.length === 0) {
      throw new BadRequestException({
        message: 'No bulk update operations provided.',
      });
    }

    for (const op of ops) {
      if (op.op === 'create' || op.op === 'update') {
        if (!op.data) {
          continue;
        }

        for (const [field, value] of Object.entries(op.data)) {
          const columnSpec = columnMap.get(field);

          // Extra fields not in schema are allowed - they will only be stored in __fields JSON
          if (field !== 'id' && !columnSpec) {
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

  async downloadWithoutJob(id: WorkbookId, actor: Actor): Promise<DownloadWorkbookWithoutJobResult> {
    const workbook = await this.findOneOrThrow(id, actor);
    return this.downloadAllSnapshotTablesInBackground(workbook, actor);
  }

  /**
   * Download records for a single snapshot table synchronously (no job queue).
   * Used for sample data import where we want the API call to be synchronous.
   */
  async downloadSingleTableSync(
    workbookId: WorkbookId,
    snapshotTableId: string,
    actor: Actor,
  ): Promise<{ records: number }> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const table = workbook.snapshotTables?.find((t) => t.id === snapshotTableId);
    if (!table) {
      throw new NotFoundException('Snapshot table not found');
    }

    const connector = await this.getConnectorForSnapshotTable(table, actor);
    const tableSpec = table.tableSpec as AnyTableSpec;

    let totalCount = 0;

    try {
      await connector.downloadTableRecords(
        tableSpec,
        table.columnSettings as SnapshotColumnSettingsMap,
        async (params) => {
          const { records } = params;
          await this.snapshotDbService.snapshotDb.upsertRecords(
            workbookId,
            { spec: tableSpec, tableName: table.tableName },
            records,
          );
          totalCount += records.length;
        },
        {
          publicProgress: {},
          jobProgress: {},
          connectorProgress: {},
        },
      );

      // Set lock=null and update lastSyncTime for this table on success
      await this.db.client.snapshotTable.update({
        where: { id: table.id },
        data: {
          lock: null,
          lastSyncTime: new Date(),
        },
      });

      // Send snapshot-updated event to client
      this.snapshotEventService.sendSnapshotEvent(workbookId, {
        type: 'snapshot-updated',
        data: {
          tableId: table.id,
          source: 'agent',
        },
      });
    } catch (error) {
      // Set lock=null for this table on failure
      await this.db.client.snapshotTable.update({
        where: { id: table.id },
        data: { lock: null },
      });

      throw exceptionForConnectorError(error, connector);
    }

    return { records: totalCount };
  }

  async download(id: WorkbookId, actor: Actor, snapshotTableIds?: string[]): Promise<DownloadWorkbookResult> {
    if (!this.configService.getUseJobs()) {
      // Fall back to synchronous download when jobs are not available
      await this.downloadWithoutJob(id, actor);
      return {
        jobId: 'sync-download', // Use a placeholder ID for synchronous downloads
      };
    }
    // Construct initial public progress
    const workbook = await this.findOneOrThrow(id, actor);
    let snapshotTablesToProcess = workbook.snapshotTables || [];
    if (snapshotTableIds && snapshotTableIds.length > 0) {
      snapshotTablesToProcess = snapshotTablesToProcess.filter((st) => snapshotTableIds.includes(st.id));
    }

    const initialPublicProgressTables: DownloadRecordsPublicProgress['tables'] = [];
    for (const st of snapshotTablesToProcess) {
      initialPublicProgressTables.push({
        id: (st.tableSpec as AnyTableSpec).id.wsId,
        name: (st.tableSpec as AnyTableSpec).name,
        connector: st.connectorService,
        records: 0,
        status: 'pending' as const,
      });
    }

    const initialPublicProgress: DownloadRecordsPublicProgress = {
      totalRecords: 0,
      tables: initialPublicProgressTables,
    };
    const job = await this.bullEnqueuerService.enqueueDownloadRecordsJob(
      id,
      actor,
      snapshotTableIds,
      initialPublicProgress,
    );

    // Set lock='download' for all tables immediately after enqueuing
    await this.db.client.snapshotTable.updateMany({
      where: {
        id: { in: snapshotTablesToProcess.map((t) => t.id) },
      },
      data: {
        lock: 'download',
      },
    });

    return {
      jobId: job.id as string,
    };
  }

  private async downloadAllSnapshotTablesInBackground(
    workbook: WorkbookCluster.Workbook,
    actor: Actor,
  ): Promise<DownloadWorkbookWithoutJobResult> {
    const tables = workbook.snapshotTables ?? [];

    // Set lock='download' for all tables
    await this.db.client.snapshotTable.updateMany({
      where: {
        id: { in: tables.map((t) => t.id) },
      },
      data: {
        lock: 'download',
      },
    });

    let totalCount = 0;
    const tableResults: { id: string; name: string; records: number }[] = [];
    for (const table of tables) {
      const connector = await this.getConnectorForSnapshotTable(table, actor);

      const tableSpec = table.tableSpec as AnyTableSpec;
      WSLogger.debug({
        source: 'WorkbookService',
        message: 'Downloading records',
        tableName: table.tableName,
        tableId: table.id,
        workbookId: workbook.id,
      });

      try {
        await connector.downloadTableRecords(
          tableSpec,
          table.columnSettings as SnapshotColumnSettingsMap,
          async (params) => {
            const { records } = params;
            await this.snapshotDbService.snapshotDb.upsertRecords(
              workbook.id as WorkbookId,
              { spec: tableSpec, tableName: table.tableName },
              records,
            );
            totalCount += records.length;
            tableResults.push({
              id: table.id,
              name: tableSpec.name,
              records: records.length,
            });
          },
          {
            publicProgress: {},
            jobProgress: {},
            connectorProgress: {},
          },
        );

        // Set lock=null and update lastSyncTime for this table on success
        await this.db.client.snapshotTable.update({
          where: { id: table.id },
          data: {
            lock: null,
            lastSyncTime: new Date(),
          },
        });

        // Send snapshot-updated event to client
        this.snapshotEventService.sendSnapshotEvent(workbook.id as WorkbookId, {
          type: 'snapshot-updated',
          data: {
            tableId: table.id,
            source: 'agent',
          },
        });
      } catch (error) {
        // Set lock=null for this table on failure
        await this.db.client.snapshotTable.update({
          where: { id: table.id },
          data: { lock: null },
        });

        throw exceptionForConnectorError(error, connector);
      }
    }

    WSLogger.debug({
      source: 'WorkbookService',
      message: 'Done downloading snapshot',
      workbookId: workbook.id,
      recordsDownloaded: totalCount,
      tablesDownloaded: tables.length,
    });

    return {
      totalRecords: totalCount,
      tables: tableResults,
    };
  }

  async publish(id: WorkbookId, actor: Actor, snapshotTableIds?: string[]): Promise<{ jobId: string }> {
    // Check publish limit for the organization
    if (actor.subscriptionStatus) {
      const plan = getPlan(actor.subscriptionStatus.planType);
      if (plan && plan.features.publishingLimit > 0) {
        const monthlyPublishCount = await this.subscriptionService.countMonthlyPublishActions(actor.organizationId);
        if (monthlyPublishCount >= plan.features.publishingLimit) {
          throw new BadRequestException(
            `Publishing limit reached. Your plan allows ${plan.features.publishingLimit} publishes per month.`,
          );
        }
      }
    }

    if (!this.configService.getUseJobs()) {
      // Fall back to synchronous publish when jobs are not available
      await this.publishWithoutJob(id, actor);
      return {
        jobId: 'sync-publish', // Use a placeholder ID for synchronous publishes
      };
    }
    // Construct initial public progress
    const workbook = await this.findOneOrThrow(id, actor);
    let snapshotTablesToProcess = workbook.snapshotTables || [];
    if (snapshotTableIds && snapshotTableIds.length > 0) {
      snapshotTablesToProcess = snapshotTablesToProcess.filter((st) => snapshotTableIds.includes(st.id));
    }

    const initialPublicProgressTables: PublishRecordsPublicProgress['tables'] = [];
    for (const st of snapshotTablesToProcess) {
      const counts = await this.snapshotDbService.snapshotDb.countExpectedOperations(id, st.tableName);
      initialPublicProgressTables.push({
        id: (st.tableSpec as AnyTableSpec).id.wsId,
        name: (st.tableSpec as AnyTableSpec).name,
        connector: st.connectorService,
        creates: 0,
        updates: 0,
        deletes: 0,
        expectedCreates: counts.creates,
        expectedUpdates: counts.updates,
        expectedDeletes: counts.deletes,
        status: 'pending' as const,
      });
    }

    const initialPublicProgress: PublishRecordsPublicProgress = {
      totalRecordsPublished: 0,
      tables: initialPublicProgressTables,
    };
    const job = await this.bullEnqueuerService.enqueuePublishRecordsJob(
      id,
      actor,
      snapshotTableIds,
      initialPublicProgress,
    );

    // Set lock='publish' for all tables immediately after enqueuing
    await this.db.client.snapshotTable.updateMany({
      where: {
        id: { in: snapshotTablesToProcess.map((t) => t.id) },
      },
      data: {
        lock: 'publish',
      },
    });

    // Track analytics and audit log when job is enqueued
    this.posthogService.trackPublishWorkbook(actor.userId, workbook);
    await this.auditLogService.logEvent({
      actor,
      eventType: 'publish',
      message: `Publishing workbook ${workbook.name}`,
      entityId: workbook.id as WorkbookId,
    });

    return {
      jobId: job.id as string,
    };
  }

  async publishWithoutJob(id: WorkbookId, actor: Actor): Promise<void> {
    const workbook = await this.findOneOrThrow(id, actor);

    await this.publishAllTablesInWorkbook(workbook, actor);

    this.posthogService.trackPublishWorkbook(actor.userId, workbook);
    await this.auditLogService.logEvent({
      actor,
      eventType: 'publish',
      message: `Published workbook ${workbook.name}`,
      entityId: workbook.id as WorkbookId,
    });

    // Update onboarding flow if user hasn't completed this step yet
    if (actor.onboarding?.gettingStartedV1?.dataPublished?.completed === false) {
      await this.onboardingService.markStepCompleted(actor.userId, 'gettingStartedV1', 'dataPublished');
    }
  }

  async getPublishSummary(id: WorkbookId, actor: Actor, snapshotTableIds?: string[]): Promise<PublishSummaryDto> {
    const workbook = await this.findOneOrThrow(id, actor);

    // if (!snapshot.connectorAccount) {
    //   throw new BadRequestException('Cannot get publish summary for connectorless snapshots');
    // }

    // Filter tables if specific table IDs are provided
    let tables = workbook.snapshotTables ?? [];
    if (snapshotTableIds && snapshotTableIds.length > 0) {
      tables = tables.filter((table) => snapshotTableIds.includes(table.id));
    }

    const summary: PublishSummaryDto = {
      deletes: [],
      updates: [],
      creates: [],
    };

    for (const table of tables) {
      const tableSpec = table.tableSpec as AnyTableSpec;
      // Get records to be deleted
      const deletedRecords = await this.getRecordsForOperation(
        workbook.id as WorkbookId,
        table.tableName,
        'delete',
        false,
      );
      if (deletedRecords.length > 0) {
        summary.deletes.push({
          tableId: table.id,
          tableName: tableSpec.name,
          records: deletedRecords.map((record) => ({
            wsId: record.id.wsId,
            title: this.getRecordTitle(record, tableSpec),
          })),
        });
      }

      // Get records to be updated
      const updatedRecords = await this.getRecordsForOperation(
        workbook.id as WorkbookId,
        table.tableName,
        'update',
        false,
      );
      if (updatedRecords.length > 0) {
        summary.updates.push({
          tableId: table.id,
          tableName: tableSpec.name,
          records: updatedRecords.map((record) => ({
            wsId: record.id.wsId,
            title: this.getRecordTitle(record, tableSpec),
            changes: this.getRecordChanges(record, tableSpec),
          })),
        });
      }

      // Get count of records to be created
      const createdRecords = await this.getRecordsForOperation(
        workbook.id as WorkbookId,
        table.tableName,
        'create',
        false,
      );
      if (createdRecords.length > 0) {
        summary.creates.push({
          tableId: table.id,
          tableName: tableSpec.name,
          count: createdRecords.length,
        });
      }
    }

    return summary;
  }

  private async getConnectorForSnapshotTable(
    table: WorkbookCluster.SnapshotTable,
    actor: Actor,
  ): Promise<Connector<Service, any>> {
    // need a full connector account object with decoded credentials
    const connectorAccountWithCreds = table.connectorAccountId
      ? await this.connectorAccountService.findOne(table.connectorAccountId, actor)
      : null;

    return this.connectorService.getConnector({
      service: table.connectorService as Service,
      connectorAccount: connectorAccountWithCreds,
      decryptedCredentials: connectorAccountWithCreds,
      userId: actor.userId,
    });
  }

  private async publishAllTablesInWorkbook(workbook: WorkbookCluster.Workbook, actor: Actor): Promise<void> {
    const tableAndConnector: {
      table: WorkbookCluster.SnapshotTable;
      tableSpec: TableSpecs[Service];
      connector: Connector<Service, any>;
    }[] = [];
    for (const table of workbook.snapshotTables) {
      const connector = await this.getConnectorForSnapshotTable(table, actor);
      tableAndConnector.push({ table, tableSpec: table.tableSpec as AnyTableSpec, connector });
    }

    // Track which tables had operations performed
    const tableIdsWithOperations = new Set<string>();

    // First create everything.
    for (const { table, tableSpec, connector } of tableAndConnector) {
      const count = await this.publishCreatesToTable(workbook, connector, table, tableSpec);
      if (count > 0) {
        tableIdsWithOperations.add(table.id);
      }
    }

    // Then apply updates since it might depend on the created IDs, and clear out FKs to the deleted records.
    for (const { table, tableSpec, connector } of tableAndConnector) {
      const count = await this.publishUpdatesToTable(workbook, connector, table, tableSpec);
      if (count > 0) {
        tableIdsWithOperations.add(table.id);
      }
    }

    // Finally the deletes since hopefully nothing references them any more.
    for (const { table, tableSpec, connector } of tableAndConnector) {
      const count = await this.publishDeletesToTable(workbook, connector, table, tableSpec);
      if (count > 0) {
        tableIdsWithOperations.add(table.id);
      }
    }

    // Update lastSyncTime only for tables that had operations performed
    if (tableIdsWithOperations.size > 0) {
      await this.db.client.snapshotTable.updateMany({
        where: {
          id: { in: Array.from(tableIdsWithOperations) },
        },
        data: {
          lastSyncTime: new Date(),
        },
      });
    }

    WSLogger.debug({
      source: 'WorkbookService.publishSnapshot',
      message: 'Done publishing snapshot',
      workbookId: workbook.id,
    });
  }

  private async publishCreatesToTable<S extends Service>(
    workbook: WorkbookCluster.Workbook,
    connector: Connector<S>,
    table: WorkbookCluster.SnapshotTable,
    tableSpec: TableSpecs[S],
  ): Promise<number> {
    return await this.snapshotDbService.snapshotDb.forAllDirtyRecords(
      workbook.id as WorkbookId,
      table.tableName,
      'create',
      connector.getBatchSize('create'),
      async (records, trx) => {
        const sanitizedRecords = records
          .map((record) => filterToOnlyEditedKnownFields(record, tableSpec))
          .map((r) => ({ wsId: r.id.wsId, fields: r.fields }));

        const returnedRecords = await connector.createRecords(
          tableSpec,
          table.columnSettings as SnapshotColumnSettingsMap,
          sanitizedRecords,
        );
        // Save the created IDs.
        await this.snapshotDbService.snapshotDb.updateRemoteIds(
          workbook.id as WorkbookId,
          { spec: tableSpec, tableName: table.tableName },
          returnedRecords,
          trx,
        );
      },
      true,
    );
  }

  async publishCreatesToTableWithProgress<S extends Service>(
    workbook: WorkbookCluster.Workbook,
    connector: Connector<S>,
    table: WorkbookCluster.SnapshotTable,
    tableSpec: TableSpecs[S],
    onProgress: (count: number) => Promise<void>,
  ): Promise<void> {
    await this.snapshotDbService.snapshotDb.forAllDirtyRecords(
      workbook.id as WorkbookId,
      table.tableName,
      'create',
      connector.getBatchSize('create'),
      async (records, trx) => {
        const sanitizedRecords = records
          .map((record) => filterToOnlyEditedKnownFields(record, tableSpec))
          .map((r) => ({ wsId: r.id.wsId, fields: r.fields }));

        const returnedRecords = await connector.createRecords(
          tableSpec,
          table.columnSettings as SnapshotColumnSettingsMap,
          sanitizedRecords,
        );
        // Save the created IDs.
        await this.snapshotDbService.snapshotDb.updateRemoteIds(
          workbook.id as WorkbookId,
          { spec: tableSpec, tableName: table.tableName },
          returnedRecords,
          trx,
        );

        // Call progress callback with count
        await onProgress(records.length);
      },
      true,
    );
  }

  private async publishUpdatesToTable<S extends Service>(
    workbook: WorkbookCluster.Workbook,
    connector: Connector<S>,
    table: WorkbookCluster.SnapshotTable,
    tableSpec: TableSpecs[S],
  ): Promise<number> {
    // Then apply updates since it might depend on the created IDs, and clear out FKs to the deleted records.

    return await this.snapshotDbService.snapshotDb.forAllDirtyRecords(
      workbook.id as WorkbookId,
      table.tableName,
      'update',
      connector.getBatchSize('update'),
      async (records) => {
        const sanitizedRecords = records.map((record) =>
          connector.sanitizeRecordForUpdate(record as ExistingSnapshotRecord, tableSpec),
        );
        await connector.updateRecords(tableSpec, table.columnSettings as SnapshotColumnSettingsMap, sanitizedRecords);
      },
      true,
    );
  }

  async publishUpdatesToTableWithProgress<S extends Service>(
    workbook: WorkbookCluster.Workbook,
    connector: Connector<S>,
    table: WorkbookCluster.SnapshotTable,
    tableSpec: TableSpecs[S],
    onProgress: (count: number) => Promise<void>,
  ): Promise<void> {
    // Then apply updates since it might depend on the created IDs, and clear out FKs to the deleted records.

    await this.snapshotDbService.snapshotDb.forAllDirtyRecords(
      workbook.id as WorkbookId,
      table.tableName,
      'update',
      connector.getBatchSize('update'),
      async (records) => {
        const sanitizedRecords = records.map((record) =>
          connector.sanitizeRecordForUpdate(record as ExistingSnapshotRecord, tableSpec),
        );
        await connector.updateRecords(tableSpec, table.columnSettings as SnapshotColumnSettingsMap, sanitizedRecords);

        // Call progress callback with count
        await onProgress(records.length);
      },
      true,
    );
  }

  private async publishDeletesToTable<S extends Service>(
    workbook: WorkbookCluster.Workbook,
    connector: Connector<S>,
    table: WorkbookCluster.SnapshotTable,
    tableSpec: TableSpecs[S],
  ): Promise<number> {
    // Finally the deletes since hopefully nothing references them.

    return await this.snapshotDbService.snapshotDb.forAllDirtyRecords(
      workbook.id as WorkbookId,
      table.tableName,
      'delete',
      connector.getBatchSize('delete'),
      async (records, trx) => {
        const recordIds = records
          .filter((r) => !!r.id.remoteId)
          .map((r) => ({ wsId: r.id.wsId, remoteId: r.id.remoteId! }));

        await connector.deleteRecords(tableSpec, recordIds);

        // Remove them from the snapshot.
        await this.snapshotDbService.snapshotDb.deleteRecords(
          workbook.id as WorkbookId,
          table.tableName,
          records.map((r) => r.id.wsId),
          trx,
        );
      },
      true,
    );
  }

  async publishDeletesToTableWithProgress<S extends Service>(
    workbook: WorkbookCluster.Workbook,
    connector: Connector<S>,
    table: WorkbookCluster.SnapshotTable,
    tableSpec: TableSpecs[S],
    onProgress: (count: number) => Promise<void>,
  ): Promise<void> {
    // Finally the deletes since hopefully nothing references them.

    await this.snapshotDbService.snapshotDb.forAllDirtyRecords(
      workbook.id as WorkbookId,
      table.tableName,
      'delete',
      connector.getBatchSize('delete'),
      async (records, trx) => {
        const recordIds = records
          .filter((r) => !!r.id.remoteId)
          .map((r) => ({ wsId: r.id.wsId, remoteId: r.id.remoteId! }));

        await connector.deleteRecords(tableSpec, recordIds);

        // Remove them from the snapshot.
        await this.snapshotDbService.snapshotDb.deleteRecords(
          workbook.id as WorkbookId,
          table.tableName,
          records.map((r) => r.id.wsId),
          trx,
        );

        // Call progress callback with count
        await onProgress(records.length);
      },
      true,
    );
  }

  async setActiveRecordsFilter(
    workbookId: WorkbookId,
    tableId: string,
    dto: SetActiveRecordsFilterDto,
    actor: Actor,
  ): Promise<void> {
    const workbook = await this.findOneOrThrow(workbookId, actor);

    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    // Validate SQL WHERE clause if provided
    if (dto.sqlWhereClause && dto.sqlWhereClause.trim() !== '') {
      try {
        // make sure the SQL WHERE clause is properly formatted and safe to use
        validateWhereClause(dto.sqlWhereClause);
      } catch (error) {
        throw new BadRequestException(
          `Invalid SQL WHERE clause. Please check your syntax and column names. ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      const errorMessage = await this.snapshotDbService.snapshotDb.validateSqlFilter(
        workbookId,
        snapshotTable.tableName,
        dto.sqlWhereClause,
      );
      if (errorMessage) {
        throw new BadRequestException(
          `Invalid SQL WHERE clause. Please check your syntax and column names. ${errorMessage}`,
        );
      }
    }

    await this.db.client.snapshotTable.update({
      where: { id: snapshotTable.id },
      data: {
        activeRecordSqlFilter: dto.sqlWhereClause,

        // Reset pagination.
        pageSize: null,
        currentSkip: 0,
      },
    });

    this.snapshotEventService.sendSnapshotEvent(workbookId, {
      type: 'filter-changed',
      data: {
        tableId,
        source: 'user',
      },
    });
  }

  async clearActiveRecordFilter(workbookId: WorkbookId, tableId: string, actor: Actor): Promise<void> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    await this.db.client.snapshotTable.update({
      where: { id: snapshotTable.id },
      data: {
        activeRecordSqlFilter: null,
      },
    });

    this.snapshotEventService.sendSnapshotEvent(workbookId, {
      type: 'filter-changed',
      data: {
        tableId,
        source: 'user',
      },
    });
  }

  async setTableViewState(
    workbookId: WorkbookId,
    tableId: string,
    pageSize: number | null | undefined,
    currentSkip: number | null | undefined,
    actor: Actor,
  ): Promise<void> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    const updateData: { pageSize?: number | null; currentSkip?: number | null } = {};
    if (pageSize !== undefined) {
      updateData.pageSize = pageSize;
    }
    if (currentSkip !== undefined) {
      updateData.currentSkip = currentSkip;
    }

    await this.db.client.snapshotTable.update({
      where: { id: snapshotTable.id },
      data: updateData,
    });
  }

  private async getRecordsForOperation(
    workbookId: WorkbookId,
    tableName: string,
    operation: 'create' | 'update' | 'delete',
    markAsClean: boolean,
  ): Promise<SnapshotRecord[]> {
    const records: SnapshotRecord[] = [];

    await this.snapshotDbService.snapshotDb.forAllDirtyRecords(
      workbookId,
      tableName,
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

      // Skip scratch columns since they are not saved to the connector
      if (column.metadata?.scratch) {
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
   * Export a snapshot as CSV without authentication (public endpoint)
   * Security relies on snapshot IDs being unguessable
   */
  async exportAsCsvPublic(
    workbookId: WorkbookId,
    tableId: string,
    filteredOnly: boolean,
    res: Response,
  ): Promise<void> {
    // Get workbook without user check
    const workbook = await this.db.client.workbook.findUnique({
      where: { id: workbookId },
      include: WorkbookCluster._validator.include,
    });

    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in workbook ${workbookId}`);
    }

    await this.streamCsvExport(workbook, snapshotTable, filteredOnly, res);
  }

  /**
   * Helper method to stream CSV export
   */
  private async streamCsvExport(
    workbook: WorkbookCluster.Workbook,
    snapshotTable: SnapshotTable,
    filteredOnly: boolean,
    res: Response,
  ): Promise<void> {
    try {
      // Get column names to exclude internal metadata fields and wsId
      const columnQuery = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = '${workbook.id}'
        AND table_name = '${snapshotTable.tableName}'
        AND column_name NOT IN ('${SCRATCH_ID_COLUMN}', '${EDITED_FIELDS_COLUMN}', '${SUGGESTED_FIELDS_COLUMN}', '${METADATA_COLUMN}', '${DIRTY_COLUMN}', '${SEEN_COLUMN}', '__original')
        ORDER BY ordinal_position
      `;

      interface ColumnInfo {
        rows: {
          column_name: string;
        }[];
      }
      const columns = await this.snapshotDbService.snapshotDb.getKnex().raw<ColumnInfo>(columnQuery);
      const columnNames = columns.rows.map((row) => row.column_name);

      if (columnNames.length === 0) {
        throw new BadRequestException(`No columns found to export for table ${snapshotTable.id}`);
      }

      // Check if we should apply the SQL filter
      const sqlWhereClause = filteredOnly ? snapshotTable.activeRecordSqlFilter : null;

      // Build the WHERE clause if filter should be applied and exists
      const whereClause =
        filteredOnly && sqlWhereClause && sqlWhereClause.trim() !== '' ? ` WHERE ${sqlWhereClause}` : '';

      // Clear __dirty and __edited_fields for all records being exported (only for "Export All", not filtered)
      // if (!filteredOnly) {
      //   await this.snapshotDbService.snapshotDb.getKnex()(`${workbook.id}.${tableId}`).update({
      //     __dirty: false,
      //     __edited_fields: {},
      //   });
      // }

      // Set response headers
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      const filename = `${workbook.name || 'workbook'}_${snapshotTable.id}.csv`;
      const encodedFilename = encodeURIComponent(filename);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`);

      // Use the CSV stream helper to stream the data
      const { stream, cleanup } = await createCsvStream({
        knex: this.snapshotDbService.snapshotDb.getKnex(),
        schema: workbook.id,
        table: snapshotTable.tableName,
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

  async importSuggestions(
    workbookId: WorkbookId,
    tableId: string,
    buffer: Buffer,
    actor: Actor,
  ): Promise<ImportSuggestionsResponseDto> {
    // Verify user has access to the workbook
    const workbook = await this.findOne(workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    // Find the table specification
    const tableSpec = getTableSpecById(workbook, tableId);
    if (!tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in workbook ${workbookId}`);
    }

    // Parse CSV to process suggestions
    const csvParse = await import('csv-parse');
    const parse = csvParse.parse;

    return new Promise((resolve, reject) => {
      const parser = parse({
        columns: true, // Parse header row as column names
        skip_empty_lines: true,
        trim: true,
      });

      const records: Array<Record<string, string>> = [];
      const chunkSize = 5;
      let recordsProcessed = 0;
      let suggestionsCreated = 0;

      parser.on('readable', function () {
        let record: Record<string, string> | null;
        while ((record = parser.read() as Record<string, string> | null) !== null) {
          records.push(record);
        }
      });

      parser.on('error', (err) => {
        reject(new BadRequestException(`CSV parsing error: ${err.message}`));
      });

      parser.on('end', () => {
        void (async () => {
          try {
            // Validate that id column exists
            if (records.length === 0) {
              throw new BadRequestException('CSV file is empty');
            }

            const firstRecord = records[0];
            if (!firstRecord['id']) {
              throw new BadRequestException('CSV must have an "id" column (remote ID) to match records');
            }

            // Create a map of column names to column IDs
            const columnMap = new Map<string, string>();
            for (const column of tableSpec.columns) {
              columnMap.set(column.name, column.id.wsId);
            }

            // Process records in chunks
            for (let i = 0; i < records.length; i += chunkSize) {
              const chunk = records.slice(i, i + chunkSize);

              // Get all remote IDs from this chunk
              const remoteIds = chunk.map((record) => record['id']).filter((id) => id);

              // Look up wsIds for these remote IDs (wsId is the internal primary key)
              const dbRecords = await this.snapshotDbService.snapshotDb
                .getKnex()(tableId)
                .withSchema(workbookId)
                .whereIn(REMOTE_ID_COLUMN, remoteIds)
                .select<
                  Array<{ [REMOTE_ID_COLUMN]: string; [SCRATCH_ID_COLUMN]: string }>
                >(REMOTE_ID_COLUMN, SCRATCH_ID_COLUMN);

              // Create a map of remote ID (user-visible) to wsId (internal primary key)
              // Currently bulkUpdateRecords expects wsIds but the user works with remoteIds
              // so we do the mapping here. We could get bulkUpdateRecords to accept either id in the future
              const remoteIdToWsId = new Map<string, string>();
              for (const dbRecord of dbRecords) {
                remoteIdToWsId.set(dbRecord[REMOTE_ID_COLUMN], dbRecord[SCRATCH_ID_COLUMN]);
              }

              const operations: UpdateRecordOperation[] = [];

              for (const record of chunk) {
                const remoteId = record['id'];
                if (!remoteId) {
                  continue; // Skip records without id
                }

                // Look up the wsId for this remote ID
                const wsId = remoteIdToWsId.get(remoteId);
                if (!wsId) {
                  WSLogger.warn({
                    source: 'WorkbookService.importSuggestions',
                    message: `Record with id "${remoteId}" not found in table`,
                    workbookId,
                    tableId,
                  });
                  recordsProcessed++;
                  continue;
                }

                const data: Record<string, unknown> = {};
                let hasData = false;

                // Process each column in the CSV (except id)
                for (const [columnName, value] of Object.entries(record)) {
                  if (columnName === 'id') {
                    continue; // Skip the id column
                  }

                  // Only include non-empty values
                  if (value && value.trim() !== '') {
                    const columnId = columnMap.get(columnName);
                    if (columnId) {
                      data[columnId] = value;
                      hasData = true;
                    } else {
                      WSLogger.warn({
                        source: 'WorkbookService.importSuggestions',
                        message: `Column "${columnName}" not found in table spec`,
                        workbookId,
                        tableId,
                      });
                    }
                  }
                }

                if (hasData) {
                  operations.push({
                    op: 'update',
                    wsId,
                    data,
                  });
                  suggestionsCreated += Object.keys(data).length;
                }

                recordsProcessed++;
              }

              // Create suggestions for this chunk using wsId-based operations
              if (operations.length > 0) {
                await this.bulkUpdateRecords(
                  workbookId,
                  tableId,
                  { creates: [], updates: operations, deletes: [], undeletes: [] },
                  actor,
                  'suggested',
                );
              }
            }

            resolve({
              recordsProcessed,
              suggestionsCreated,
            });
          } catch (error) {
            if (error instanceof BadRequestException) {
              reject(error);
            } else {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              reject(new BadRequestException(`Failed to import suggestions: ${errorMessage}`));
            }
          }
        })();
      });

      // Start parsing
      parser.write(buffer);
      parser.end();
    });
  }

  async setTitleColumn(workbookId: WorkbookId, tableId: string, columnId: string, actor: Actor): Promise<void> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    if (!snapshotTable.tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;
    // Verify the column exists in the table
    const column = tableSpec.columns.find((c) => c.id.wsId === columnId);
    if (!column) {
      throw new NotFoundException('Column not found in table');
    }

    // Update the table spec with the new title column
    const updatedTableSpec = {
      ...tableSpec,
      titleColumnRemoteId: [columnId],
    };

    // Update the snapshot with the new table specs
    await this.db.client.snapshotTable.update({
      where: { id: snapshotTable.id },
      data: {
        tableSpec: updatedTableSpec as InputJsonObject,
      },
    });

    this.snapshotEventService.sendSnapshotEvent(workbookId, {
      type: 'snapshot-updated',
      data: { source: 'user', tableId },
    });

    await this.auditLogService.logEvent({
      actor,
      eventType: 'update',
      message: `Set title column for table ${tableSpec.name} to ${column.name}`,
      entityId: workbookId,
      context: {
        tableId,
        columnId,
        columnName: column.name,
      },
    });
  }

  async setContentColumn(workbookId: WorkbookId, tableId: string, columnId: string, actor: Actor): Promise<void> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    if (!snapshotTable.tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;
    // Verify the column exists in the table
    const column = tableSpec.columns.find((c) => c.id.wsId === columnId);
    if (!column) {
      throw new NotFoundException('Column not found in table');
    }

    // Update the table spec with the new content column
    const updatedTableSpec = {
      ...tableSpec,
      mainContentColumnRemoteId: [columnId],
    };

    // Update the snapshot with the new table specs
    await this.db.client.snapshotTable.update({
      where: { id: snapshotTable.id },
      data: {
        tableSpec: updatedTableSpec as InputJsonObject,
      },
    });

    this.snapshotEventService.sendSnapshotEvent(workbookId, {
      type: 'snapshot-updated',
      data: { source: 'user', tableId },
    });

    await this.auditLogService.logEvent({
      actor,
      eventType: 'update',
      message: `Set content column for table ${tableSpec.name} to ${column.name}`,
      entityId: workbookId,
      context: {
        tableId,
        columnId,
        columnName: column.name,
      },
    });
  }

  async addScratchColumn(
    workbookId: WorkbookId,
    tableId: string, // The WS Table ID
    addScratchColumnDto: ValidatedAddScratchColumnDto,
    actor: Actor,
  ): Promise<void> {
    const { columnName, dataType } = addScratchColumnDto;
    const workbook = await this.findOne(workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    const columnId = sanitizeForColumnWsId(columnName);
    if (DEFAULT_COLUMNS.includes(columnId)) {
      throw new BadRequestException(
        `Column name ${columnName} is reserved and cannot be used. Choose a different name.`,
      );
    }

    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;
    // check the column isn't already used
    const existingColumn = tableSpec.columns.find((c) => c.id.wsId === columnId);
    if (existingColumn) {
      throw new BadRequestException(
        `Column ${columnName} already exists in table ${tableSpec.name}. Choose a different name.`,
      );
    }

    const columnSpec: BaseColumnSpec = {
      id: { wsId: columnId, remoteId: [columnId, 'scratch-column'] },
      name: columnName,
      pgType: dataType,
      metadata: {
        scratch: true,
      },
    };

    const newTableSpec = {
      ...tableSpec,
      columns: [...tableSpec.columns, columnSpec],
    };

    await this.db.client.snapshotTable.update({
      where: { id: snapshotTable.id },
      data: {
        tableSpec: newTableSpec as InputJsonObject,
      },
    });

    await this.snapshotDbService.snapshotDb.addColumn(workbookId, snapshotTable.tableName, {
      columnId,
      columnType: dataType,
    });

    this.snapshotEventService.sendSnapshotEvent(workbookId, {
      type: 'snapshot-updated',
      data: { source: 'user', tableId },
    });

    await this.auditLogService.logEvent({
      actor,
      eventType: 'update',
      message: `Added scratch column ${columnName} to table ${tableSpec.name}`,
      entityId: workbookId,
      context: {
        tableId,
        columnId,
        columnName,
      },
    });
  }

  async removeScratchColumn(
    workbookId: WorkbookId,
    tableId: string, // The WS Table ID
    columnId: string,
    actor: Actor,
  ): Promise<void> {
    const workbook = await this.findOne(workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;
    const column = tableSpec.columns.find((c) => c.id.wsId === columnId);
    if (!column) {
      throw new NotFoundException(`Column not found in table: ${tableSpec.name} with id: ${columnId}`);
    }

    if (!column.metadata?.scratch) {
      throw new BadRequestException(`Column ${columnId} is not a scratch column and cannot be removed`);
    }

    // Need to remove any suggestions that use this column before we remove the column, otherwise it will block future accept/reject suggestion operations
    const records = await this.snapshotDbService.snapshotDb.listRecords(
      workbookId,
      snapshotTable.tableName,
      0,
      10000,
      tableSpec,
    );

    const { allSuggestions } = this.extractSuggestions(records.records);
    const itemsToReject = allSuggestions.filter((s) => s.columnId === columnId);
    if (itemsToReject.length > 0) {
      WSLogger.debug({
        source: 'WorkbookService.removeScratchColumn',
        message: `Rejecting ${itemsToReject.length} suggestions for column ${columnId} in table ${tableSpec.name} before removing the column`,
        workbookId,
        tableId,
        columnId,
      });
      await this.rejectValues(workbookId, tableId, itemsToReject, actor);
    }

    const newTableSpec = {
      ...tableSpec,
      columns: tableSpec.columns.filter((c) => c.id.wsId !== columnId),
    };

    await this.db.client.snapshotTable.update({
      where: { id: snapshotTable.id },
      data: {
        tableSpec: newTableSpec as InputJsonObject,
      },
    });

    await this.snapshotDbService.snapshotDb.removeColumn(workbookId, snapshotTable.tableName, columnId);

    this.snapshotEventService.sendSnapshotEvent(workbookId, {
      type: 'snapshot-updated',
      data: { source: 'user', tableId },
    });

    await this.auditLogService.logEvent({
      actor,
      eventType: 'update',
      message: `Removed scratch column ${column.name} from table ${tableSpec.name}`,
      entityId: workbookId,
      context: {
        tableId,
        columnId,
        columnName: column.name,
      },
    });
  }

  async hideColumn(workbookId: WorkbookId, tableId: string, columnId: string, actor: Actor): Promise<void> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    if (_.some(snapshotTable.hiddenColumns, (c) => c === columnId)) {
      // no-op, just return
      return;
    }

    // confirm the column exists in the table
    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;
    const column = tableSpec.columns.find((c) => c.id.wsId === columnId);
    if (!column) {
      throw new NotFoundException(`Column ${columnId} not found in table ${tableSpec.name} with id: ${tableId}`);
    }

    const newHiddenColumns = [...(snapshotTable.hiddenColumns ?? []), columnId];
    await this.db.client.snapshotTable.update({
      where: { id: snapshotTable.id },
      data: {
        hiddenColumns: newHiddenColumns,
      },
    });

    this.snapshotEventService.sendSnapshotEvent(workbookId, {
      type: 'snapshot-updated',
      data: { source: 'user', tableId },
    });
  }

  async unhideColumn(workbookId: WorkbookId, tableId: string, columnId: string, actor: Actor): Promise<void> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${workbookId}`);
    }

    if (!snapshotTable.hiddenColumns || !_.some(snapshotTable.hiddenColumns, (c) => c === columnId)) {
      // no-op, just return
      return;
    }

    // confirm the column exists in the table
    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;
    const column = tableSpec.columns.find((c) => c.id.wsId === columnId);
    if (!column) {
      throw new NotFoundException(`Column ${columnId} not found in table ${tableSpec.name} with id: ${tableId}`);
    }

    const newHiddenColumns = snapshotTable.hiddenColumns.filter((c) => c !== columnId);

    await this.db.client.snapshotTable.update({
      where: { id: snapshotTable.id },
      data: {
        hiddenColumns: newHiddenColumns,
      },
    });

    this.snapshotEventService.sendSnapshotEvent(workbookId, {
      type: 'snapshot-updated',
      data: { source: 'user', tableId },
    });
  }

  async clearHiddenColumns(workbookId: WorkbookId, tableId: string, actor: Actor): Promise<void> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in workbook ${workbookId}`);
    }

    await this.db.client.snapshotTable.update({
      where: { id: snapshotTable.id },
      data: {
        hiddenColumns: [],
      },
    });
  }

  async resolveRemoteDeletesWithLocalEdits(
    workbookId: WorkbookId,
    tableId: string,
    recordWsIds: string[] | undefined,
    action: 'create' | 'delete',
    actor: Actor,
  ): Promise<{ recordsProcessed: number }> {
    const workbook = await this.findOneOrThrow(workbookId, actor);
    const snapshotTable = getSnapshotTableById(workbook, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in workbook ${workbookId}`);
    }

    const recordsProcessed = await this.snapshotDbService.snapshotDb.resolveRemoteDeletesWithLocalEdits(
      workbookId,
      snapshotTable.tableName,
      recordWsIds,
      action,
    );

    this.snapshotEventService.sendRecordEvent(workbookId, tableId, {
      type: 'record-changes',
      data: {
        tableId,
        numRecords: recordsProcessed,
        changeType: 'accepted',
        source: 'user',
      },
    });

    await this.auditLogService.logEvent({
      actor,
      eventType: 'update',
      message: `Handled ${recordsProcessed} remote deletes with local edits (action: ${action})`,
      entityId: workbookId,
      context: {
        tableId,
        action,
        recordsProcessed,
      },
    });

    return { recordsProcessed };
  }
}

function filterToOnlyEditedKnownFields(record: SnapshotRecord, tableSpec: AnyTableSpec): SnapshotRecord {
  const editedFieldNames = tableSpec.columns
    .filter((c) => !c.metadata?.scratch)
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
