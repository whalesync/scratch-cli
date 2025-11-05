/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConnectorAccount, Prisma, Service, SnapshotTable } from '@prisma/client';
import { InputJsonObject } from '@prisma/client/runtime/library';
import { Response } from 'express';
import _ from 'lodash';
import { AuditLogService } from 'src/audit/audit-log.service';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { SnapshotCluster } from 'src/db/cluster-types';
import { DbService } from 'src/db/db.service';
import { WSLogger } from 'src/logger';
import { PostHogService } from 'src/posthog/posthog.service';
import { DecryptedCredentials } from 'src/remote-service/connector-account/types/encrypted-credentials.interface';
import { exceptionForConnectorError } from 'src/remote-service/connectors/error';
import { sanitizeForWsId } from 'src/remote-service/connectors/ids';
import { createSnapshotId, createSnapshotTableId, SnapshotId } from 'src/types/ids';
import { Actor } from 'src/users/types';
import { createCsvStream } from 'src/utils/csv-stream.helper';
import { ViewConfig, ViewTableConfig } from 'src/view/types';
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
import { AddTableToSnapshotDto } from './dto/add-table-to-snapshot.dto';
import { BulkUpdateRecordsDto, RecordOperation, UpdateRecordOperation } from './dto/bulk-update-records.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { ImportSuggestionsResponseDto } from './dto/import-suggestions.dto';
import { PublishSummaryDto } from './dto/publish-summary.dto';
import { AddScratchColumnDto } from './dto/scratch-column.dto';
import { SetActiveRecordsFilterDto } from './dto/update-active-record-filter.dto';
import { UpdateSnapshotDto } from './dto/update-snapshot.dto';
import { DownloadSnapshotResult, DownloadSnapshotWithouotJobResult } from './entities/download-results.entity';
import { CREATED_FIELD, DEFAULT_COLUMNS, DELETED_FIELD } from './snapshot-db';
import { SnapshotDbService } from './snapshot-db.service';
import { SnapshotEventService } from './snapshot-event.service';
import { SnapshotColumnSettingsMap, SnapshotTableContext } from './types';
import { getSnapshotTableByWsId, getTableSpecByWsId } from './util';

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
    private readonly bullEnqueuerService: BullEnqueuerService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(createSnapshotDto: CreateSnapshotDto, actor: Actor): Promise<SnapshotCluster.Snapshot> {
    const { name, tables } = createSnapshotDto;

    const snapshotId = createSnapshotId();
    const tableSpecs: AnyTableSpec[] = [];
    const tableContexts: SnapshotTableContext[] = [];
    const tableCreateInput: Prisma.SnapshotTableUncheckedCreateWithoutSnapshotInput[] = [];

    if (tables) {
      for (const { connectorAccountId, tableId } of tables) {
        let connector: Connector<Service, any> | undefined = undefined;
        try {
          const connectorAccount = await this.connectorAccountService.findOne(connectorAccountId, actor);
          if (!connectorAccount) {
            throw new NotFoundException('Connector account not found');
          }
          connector = await this.connectorService.getConnector({
            service: connectorAccount.service,
            connectorAccount,
            decryptedCredentials: connectorAccount,
          });

          // Poll the connector for the set of columns.
          // This probably could be something the user selects, which would mean we poll for it earlier and just take the
          // results back here.
          const tableSpec = await connector.fetchTableSpec(tableId);
          tableSpecs.push(tableSpec);

          const tableContext = {
            id: tableId,
            activeViewId: null,
            ignoredColumns: [],
            readOnlyColumns: [],
          };
          tableContexts.push(tableContext);

          tableCreateInput.push({
            id: createSnapshotTableId(),
            connectorAccountId,
            connectorService: connectorAccount.service,
            tableSpec,
            tableContext,
            columnSettings: {},
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
      source: 'SnapshotService.create',
      message: 'Creating snapshot with tables',
      tableCount: tableSpecs.length,
    });

    const newSnapshot = await this.db.client.snapshot.create({
      data: {
        id: snapshotId,
        userId: actor.userId,
        organizationId: actor.organizationId,
        name: name ?? `New workbook`,
        snapshotTables: { create: tableCreateInput },
      },
      include: SnapshotCluster._validator.include,
    });

    WSLogger.info({
      source: 'SnapshotService.create',
      message: 'Snapshot created',
      snapshotId: newSnapshot.id,
      snapshotTablesCount: tableCreateInput.length,
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
      await this.bullEnqueuerService.enqueueDownloadRecordsJob(newSnapshot.id, actor);
    } else {
      // Fall back to synchronous download when jobs are not available
      this.downloadAllSnapshotTablesInBackground(newSnapshot, actor).catch((error) => {
        WSLogger.error({
          source: 'SnapshotService.create',
          message: 'Error downloading snapshot',
          snapshotId: newSnapshot.id,
          error,
        });
      });
    }

    this.posthogService.trackCreateSnapshot(actor.userId, newSnapshot);
    await this.auditLogService.logEvent({
      userId: actor.userId,
      organizationId: actor.organizationId,
      eventType: 'create',
      message: `Created snapshot ${newSnapshot.name}`,
      entityId: newSnapshot.id as SnapshotId,
      context: {
        tables: tableSpecs.map((t) => t.id.wsId),
        services: tableCreateInput.map((t) => t.connectorService),
      },
    });

    return newSnapshot;
  }

  /**
   * Add a new table to an existing snapshot.
   * The table can be from a different connector/service than the original snapshot.
   */
  async addTableToSnapshot(
    snapshotId: SnapshotId,
    addTableDto: AddTableToSnapshotDto,
    actor: Actor,
  ): Promise<SnapshotCluster.Snapshot> {
    const { service, connectorAccountId, tableId } = addTableDto;

    // 1. Verify snapshot exists and user has permission
    const snapshot = await this.findOne(snapshotId, actor);
    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    // 2. Get connector account if provided (for services that need it)
    let connectorAccount: ConnectorAccount | null = null;
    if (connectorAccountId) {
      connectorAccount = await this.connectorAccountService.findOne(connectorAccountId, actor);
      if (!connectorAccount) {
        throw new NotFoundException('Connector account not found');
      }
      if (connectorAccount.service !== service) {
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

    const tableContext: SnapshotTableContext = {
      id: tableId,
      activeViewId: null,
      ignoredColumns: [],
      readOnlyColumns: [],
    };

    // 4. Create the snapshotTableId first so we can pass it to the download job
    const snapshotTableId = createSnapshotTableId();

    // 5. Update snapshot record - add to legacy arrays for backward compatibility
    const updatedSnapshot = await this.db.client.snapshot.update({
      where: { id: snapshotId },
      data: {
        // Also create the new SnapshotTable record
        snapshotTables: {
          create: {
            id: snapshotTableId,
            connectorAccountId: connectorAccountId ?? null,
            connectorService: service,
            tableSpec: tableSpec,
            tableContext: tableContext,
            columnSettings: {},
          },
        },
      },
      include: SnapshotCluster._validator.include,
    });

    // 6. Create database table in snapshot's schema
    await this.snapshotDbService.snapshotDb.addTableToSnapshot(snapshotId, tableSpec);

    // 7. Start downloading records in background for this specific table only
    try {
      if (this.configService.getUseJobs()) {
        await this.bullEnqueuerService.enqueueDownloadRecordsJob(snapshotId, actor, [snapshotTableId]);
      }
      WSLogger.info({
        source: 'SnapshotService.addTableToSnapshot',
        message: 'Started downloading records for newly added table',
        snapshotId,
        snapshotTableId,
        tableId: tableSpec.id.wsId,
      });
    } catch (error) {
      WSLogger.error({
        source: 'SnapshotService.addTableToSnapshot',
        message: 'Failed to start download job for newly added table',
        error,
        snapshotId,
        snapshotTableId,
        tableId: tableSpec.id.wsId,
      });
      // Don't fail the addTable operation if download fails - table was still added successfully
    }

    WSLogger.info({
      source: 'SnapshotService.addTableToSnapshot',
      message: 'Added table to snapshot',
      snapshotId,
      tableId: tableSpec.id.wsId,
      service,
    });

    await this.auditLogService.logEvent({
      userId: actor.userId,
      organizationId: actor.organizationId,
      eventType: 'update',
      message: `Added table ${tableSpec.name} to snapshot ${snapshot.name}`,
      entityId: snapshotId,
      context: {
        tableId: tableSpec.id.wsId,
        tableName: tableSpec.name,
        service,
      },
    });

    return updatedSnapshot;
  }

  async setTableHidden(
    snapshotId: SnapshotId,
    tableId: string,
    hidden: boolean,
    actor: Actor,
  ): Promise<SnapshotCluster.Snapshot> {
    // 1. Verify snapshot exists and user has permission
    const snapshot = await this.findOne(snapshotId, actor);
    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    // 2. Update the SnapshotTable record
    await this.db.client.snapshotTable.updateMany({
      where: {
        snapshotId,
        id: tableId,
      },
      data: {
        hidden,
      },
    });

    // 3. Fetch and return updated snapshot
    const updatedSnapshot = await this.db.client.snapshot.findUnique({
      where: { id: snapshotId },
      include: SnapshotCluster._validator.include,
    });

    if (!updatedSnapshot) {
      throw new NotFoundException('Snapshot not found after update');
    }

    await this.auditLogService.logEvent({
      userId: actor.userId,
      organizationId: actor.organizationId,
      eventType: 'update',
      message: `${hidden ? 'Hidden' : 'Unhidden'} table in snapshot ${snapshot.name}`,
      entityId: snapshotId,
      context: {
        tableId,
        hidden,
      },
    });

    return updatedSnapshot;
  }

  async deleteTable(snapshotId: SnapshotId, tableId: string, actor: Actor): Promise<SnapshotCluster.Snapshot> {
    // 1. Verify snapshot exists and user has permission
    const snapshot = await this.findOne(snapshotId, actor);
    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    // 2. Get the table to delete
    const snapshotTable = await this.db.client.snapshotTable.findFirst({
      where: {
        snapshotId,
        id: tableId,
      },
    });

    if (!snapshotTable) {
      throw new NotFoundException('Table not found in snapshot');
    }

    const tableSpec = snapshotTable.tableSpec as unknown as AnyTableSpec;
    const tableName = tableSpec.name;

    // 3. Delete the database table from snapshot's schema
    try {
      await this.snapshotDbService.snapshotDb.knex.schema.withSchema(snapshotId).dropTableIfExists(tableSpec.id.wsId);
    } catch (error) {
      WSLogger.error({
        source: 'SnapshotService.deleteTable',
        message: 'Failed to drop table from database',
        error,
        snapshotId,
        tableId: tableSpec.id.wsId,
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
    const updatedSnapshot = await this.db.client.snapshot.findUnique({
      where: { id: snapshotId },
      include: SnapshotCluster._validator.include,
    });

    if (!updatedSnapshot) {
      throw new NotFoundException('Snapshot not found after deletion');
    }

    await this.auditLogService.logEvent({
      userId: actor.userId,
      organizationId: actor.organizationId,
      eventType: 'delete',
      message: `Deleted table ${tableName} from snapshot ${snapshot.name}`,
      entityId: snapshotId,
      context: {
        tableId,
        tableName,
      },
    });

    return updatedSnapshot;
  }

  async delete(id: SnapshotId, actor: Actor): Promise<void> {
    const snapshot = await this.findOneOrThrow(id, actor); // Permissions

    await this.snapshotDbService.snapshotDb.cleanUpSnapshot(id);
    await this.db.client.snapshot.delete({
      where: { id },
    });

    this.posthogService.trackRemoveSnapshot(actor.userId, snapshot);
    await this.auditLogService.logEvent({
      userId: actor.userId,
      organizationId: actor.organizationId,
      eventType: 'delete',
      message: `Deleted snapshot ${snapshot.name}`,
      entityId: snapshot.id as SnapshotId,
    });
  }

  findAllForConnectorAccount(connectorAccountId: string, actor: Actor): Promise<SnapshotCluster.Snapshot[]> {
    return this.db.client.snapshot.findMany({
      where: {
        userId: actor.userId,
        snapshotTables: {
          some: {
            connectorAccountId,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: SnapshotCluster._validator.include,
    });
  }

  findAllForUser(actor: Actor): Promise<SnapshotCluster.Snapshot[]> {
    return this.db.client.snapshot.findMany({
      where: {
        userId: actor.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: SnapshotCluster._validator.include,
    });
  }

  findOne(id: SnapshotId, actor: Actor): Promise<SnapshotCluster.Snapshot | null> {
    return this.db.client.snapshot.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: SnapshotCluster._validator.include,
    });
  }

  private async findOneOrThrow(id: SnapshotId, actor: Actor): Promise<SnapshotCluster.Snapshot> {
    const snapshot = await this.findOne(id, actor);
    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }
    return snapshot;
  }

  async update(id: SnapshotId, updateSnapshotDto: UpdateSnapshotDto, actor: Actor): Promise<SnapshotCluster.Snapshot> {
    // Check that the snapshot exists and belongs to the user.
    await this.findOneOrThrow(id, actor);

    const updatedSnapshot = await this.db.client.snapshot.update({
      where: { id },
      data: updateSnapshotDto,
      include: SnapshotCluster._validator.include,
    });

    this.snapshotEventService.sendSnapshotEvent(id, { type: 'snapshot-updated', data: { source: 'user' } });

    await this.auditLogService.logEvent({
      userId: actor.userId,
      organizationId: actor.organizationId,
      eventType: 'update',
      message: `Updated snapshot ${updatedSnapshot.name}`,
      entityId: updatedSnapshot.id as SnapshotId,
      context: {
        changes: Object.keys(updateSnapshotDto),
      },
    });

    return updatedSnapshot;
  }

  async findOneRecord(
    snapshotId: SnapshotId,
    tableId: string,
    recordId: string,
    actor: Actor,
  ): Promise<SnapshotRecord | null> {
    const snapshot = await this.findOneOrThrow(snapshotId, actor);
    const tableSpec = getTableSpecByWsId(snapshot, tableId);
    if (!tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
    }

    return this.snapshotDbService.snapshotDb.getRecord(snapshotId, tableId, recordId);
  }

  async listRecords(
    snapshotId: SnapshotId,
    tableId: string,
    actor: Actor,
    cursor: string | undefined,
    take: number,
    viewId: string | undefined,
  ): Promise<{ records: SnapshotRecord[]; nextCursor?: string; count: number; filteredCount: number }> {
    const snapshot = await this.findOneOrThrow(snapshotId, actor);

    const snapshotTable = getSnapshotTableByWsId(snapshot, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
    }

    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;

    let viewConfig: ViewConfig | undefined = undefined;

    if (viewId) {
      const view = await this.db.client.columnView.findUnique({
        where: { id: viewId },
      });
      if (view) {
        viewConfig = view.config as ViewConfig;
      }
    }

    const result = await this.snapshotDbService.snapshotDb.listRecords(
      snapshotId,
      tableId,
      cursor,
      take + 1,
      viewConfig,
      tableSpec,
      snapshotTable.activeRecordSqlFilter,
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
    actor: Actor,
    cursor: string | undefined,
    take: number,
    viewId: string | undefined,
  ): Promise<{ records: SnapshotRecord[]; nextCursor?: string; count: number; filteredCount: number }> {
    const snapshot = await this.findOneOrThrow(snapshotId, actor);
    const snapshotTable = getSnapshotTableByWsId(snapshot, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
    }
    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;
    if (!tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
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

    const result = await this.snapshotDbService.snapshotDb.listRecords(
      snapshotId,
      tableId,
      cursor,
      take + 1,
      viewConfig,
      tableSpec,
      snapshotTable.activeRecordSqlFilter,
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

  async getRecordsByIdsForAi(
    snapshotId: SnapshotId,
    tableId: string,
    recordIds: string[],
    actor: Actor,
  ): Promise<{ records: SnapshotRecord[]; totalCount: number }> {
    const snapshot = await this.findOneOrThrow(snapshotId, actor);
    const tableSpec = getTableSpecByWsId(snapshot, tableId);
    if (!tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
    }

    // Fetch the records by their IDs from the snapshot database
    const records = await this.snapshotDbService.snapshotDb.getRecordsByIds(snapshotId, tableId, recordIds);

    return {
      records,
      totalCount: records.length,
    };
  }

  async bulkUpdateRecords(
    snapshotId: SnapshotId,
    tableId: string,
    dto: BulkUpdateRecordsDto,
    actor: Actor,
    type: 'accepted' | 'suggested',
    viewId?: string,
  ): Promise<void> {
    const snapshot = await this.findOneOrThrow(snapshotId, actor);
    const tableSpec = getTableSpecByWsId(snapshot, tableId);
    if (!tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
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
    actor: Actor,
  ): Promise<{ records: SnapshotRecord[]; totalCount: number }> {
    const snapshot = await this.findOneOrThrow(snapshotId, actor);
    const snapshotTable = getSnapshotTableByWsId(snapshot, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
    }
    if (!snapshotTable.connectorAccount) {
      throw new BadRequestException(`Table ${tableId} not found in snapshot ${snapshotId}`);
    }
    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;

    const connector = await this.connectorService.getConnector({
      service: snapshotTable.connectorService,
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
          snapshotTable.connectorAccount,
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
    actor: Actor,
  ): Promise<void> {
    const snapshot = await this.findOneOrThrow(snapshotId, actor);
    const tableSpec = getTableSpecByWsId(snapshot, tableId);
    if (!tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
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
    actor: Actor,
  ): Promise<void> {
    const snapshot = await this.findOneOrThrow(snapshotId, actor);
    const tableSpec = getTableSpecByWsId(snapshot, tableId);
    if (!tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
    }

    // Validate that all columns exist in the table spec
    const columnMap = new Map(tableSpec.columns.map((c) => [c.id.wsId, c]));
    for (const item of items) {
      if (item.columnId === DELETED_FIELD || item.columnId === CREATED_FIELD) {
        // ignore the deleted field, it is handled as a special case
        continue;
      }
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
    actor: Actor,
    viewId?: string,
  ): Promise<{ recordsUpdated: number; totalChangesAccepted: number }> {
    const snapshot = await this.findOneOrThrow(snapshotId, actor);
    const tableSpec = getTableSpecByWsId(snapshot, tableId);
    if (!tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
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

    await this.acceptCellValues(snapshotId, tableId, allSuggestions, actor);

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

  async updateColumnSettings(
    snapshotId: SnapshotId,
    tableId: string,
    newColumnSettings: SnapshotColumnSettingsMap,
    actor: Actor,
  ): Promise<void> {
    // Fetch snapshot once for both permission check AND getting existing columnContexts
    const currentSnapshot = await this.findOneOrThrow(snapshotId, actor);
    const table = currentSnapshot.snapshotTables.find((t) => t.id === tableId);
    if (!table) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
    }

    const existingSettings = (table.columnSettings ?? {}) as SnapshotColumnSettingsMap;

    await this.db.client.snapshotTable.update({
      where: { id: snapshotId },
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
    snapshotId: SnapshotId,
    tableId: string,
    actor: Actor,
    viewId?: string,
  ): Promise<{ recordsRejected: number; totalChangesRejected: number }> {
    const snapshot = await this.findOneOrThrow(snapshotId, actor);
    const tableSpec = getTableSpecByWsId(snapshot, tableId);
    if (!tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
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

    await this.rejectValues(snapshotId, tableId, allSuggestions, actor);

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

  async downloadWithoutJob(id: SnapshotId, actor: Actor): Promise<DownloadSnapshotWithouotJobResult> {
    const snapshot = await this.findOneOrThrow(id, actor);

    return this.downloadAllSnapshotTablesInBackground(snapshot, actor);
  }

  async download(id: SnapshotId, actor: Actor, snapshotTableIds?: string[]): Promise<DownloadSnapshotResult> {
    if (!this.configService.getUseJobs()) {
      // Fall back to synchronous download when jobs are not available
      await this.downloadWithoutJob(id, actor);
      return {
        jobId: 'sync-download', // Use a placeholder ID for synchronous downloads
      };
    }
    const job = await this.bullEnqueuerService.enqueueDownloadRecordsJob(id, actor, snapshotTableIds);
    return {
      jobId: job.id as string,
    };
  }

  private async downloadAllSnapshotTablesInBackground(
    snapshot: SnapshotCluster.Snapshot,
    actor: Actor,
  ): Promise<DownloadSnapshotWithouotJobResult> {
    const tables = snapshot.snapshotTables ?? [];
    let totalCount = 0;
    const tableResults: { id: string; name: string; records: number }[] = [];
    for (const table of tables) {
      const connector = await this.getConnectorForSnapshotTable(table, actor);

      const tableSpec = table.tableSpec as AnyTableSpec;
      WSLogger.debug({
        source: 'SnapshotService',
        message: 'Downloading records',
        tableId: tableSpec.id.wsId,
        snapshotId: snapshot.id,
      });

      try {
        await connector.downloadTableRecords(
          tableSpec,
          table.columnSettings as SnapshotColumnSettingsMap,
          async (params) => {
            const { records } = params;
            await this.snapshotDbService.snapshotDb.upsertRecords(snapshot.id as SnapshotId, tableSpec, records);
            totalCount += records.length;
            tableResults.push({
              id: tableSpec.id.wsId,
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
      } catch (error) {
        throw exceptionForConnectorError(error, connector);
      }
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
      tables: tableResults,
    };
  }

  async publish(id: SnapshotId, actor: Actor): Promise<void> {
    const snapshot = await this.findOneOrThrow(id, actor);

    // if (!snapshot.connectorAccount) {
    //   throw new BadRequestException('Cannot publish connectorless snapshots');
    // }

    // TODO: Do this work somewhere real.
    // For now it's running synchronously, but could also be done in the background.
    await this.publishAllTablesInSnapshot(snapshot, actor);

    this.posthogService.trackPublishSnapshot(actor.userId, snapshot);
    await this.auditLogService.logEvent({
      userId: actor.userId,
      organizationId: actor.organizationId,
      eventType: 'publish',
      message: `Published snapshot ${snapshot.name}`,
      entityId: snapshot.id as SnapshotId,
    });
  }

  async getPublishSummary(id: SnapshotId, actor: Actor): Promise<PublishSummaryDto> {
    const snapshot = await this.findOneOrThrow(id, actor);

    // if (!snapshot.connectorAccount) {
    //   throw new BadRequestException('Cannot get publish summary for connectorless snapshots');
    // }

    const tableSpecs = snapshot.snapshotTables?.map((t) => t.tableSpec as AnyTableSpec) ?? [];

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

  private async getConnectorForSnapshotTable(
    table: SnapshotCluster.SnapshotTable,
    actor: Actor,
  ): Promise<Connector<Service, any>> {
    if (!table.connectorAccount || !table.connectorAccountId) {
      throw new Error('Snapshot table does not have a connector account');
    }
    // need a full connector account object with decoded credentials
    const connectorAccount = await this.connectorAccountService.findOne(table.connectorAccountId, actor);
    if (!connectorAccount) {
      throw new NotFoundException('Connector account not found');
    }

    return this.connectorService.getConnector({
      service: connectorAccount.service,
      connectorAccount: connectorAccount,
      decryptedCredentials: connectorAccount,
      userId: actor.userId,
    });
  }

  private async publishAllTablesInSnapshot(snapshot: SnapshotCluster.Snapshot, actor: Actor): Promise<void> {
    const tableAndConnector: {
      table: SnapshotCluster.SnapshotTable;
      tableSpec: TableSpecs[Service];
      connector: Connector<Service, any>;
    }[] = [];
    for (const table of snapshot.snapshotTables) {
      const connector = await this.getConnectorForSnapshotTable(table, actor);
      tableAndConnector.push({ table, tableSpec: table.tableSpec as AnyTableSpec, connector });
    }

    // First create everything.
    for (const { table, tableSpec, connector } of tableAndConnector) {
      await this.publishCreatesToTable(snapshot, connector, table, tableSpec);
    }

    // Then apply updates since it might depend on the created IDs, and clear out FKs to the deleted records.
    for (const { table, tableSpec, connector } of tableAndConnector) {
      await this.publishUpdatesToTable(snapshot, connector, table, tableSpec);
    }

    // Finally the deletes since hopefully nothing references them any more.
    for (const { tableSpec, connector } of tableAndConnector) {
      await this.publishDeletesToTable(snapshot, connector, tableSpec);
    }

    WSLogger.debug({
      source: 'SnapshotService.publishSnapshot',
      message: 'Done publishing snapshot',
      snapshotId: snapshot.id,
    });
  }

  private async publishCreatesToTable<S extends Service>(
    snapshot: SnapshotCluster.Snapshot,
    connector: Connector<S>,
    table: SnapshotCluster.SnapshotTable,
    tableSpec: TableSpecs[S],
  ): Promise<void> {
    await this.snapshotDbService.snapshotDb.forAllDirtyRecords(
      snapshot.id as SnapshotId,
      tableSpec.id.wsId,
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
          snapshot.id as SnapshotId,
          tableSpec,
          returnedRecords,
          trx,
        );
      },
      true,
    );
  }

  private async publishUpdatesToTable<S extends Service>(
    snapshot: SnapshotCluster.Snapshot,
    connector: Connector<S>,
    table: SnapshotCluster.SnapshotTable,
    tableSpec: TableSpecs[S],
  ): Promise<void> {
    // Then apply updates since it might depend on the created IDs, and clear out FKs to the deleted records.

    await this.snapshotDbService.snapshotDb.forAllDirtyRecords(
      snapshot.id as SnapshotId,
      tableSpec.id.wsId,
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

  private async publishDeletesToTable<S extends Service>(
    snapshot: SnapshotCluster.Snapshot,
    connector: Connector<S>,
    tableSpec: TableSpecs[S],
  ): Promise<void> {
    // Finally the deletes since hopefully nothing references them.

    await this.snapshotDbService.snapshotDb.forAllDirtyRecords(
      snapshot.id as SnapshotId,
      tableSpec.id.wsId,
      'delete',
      connector.getBatchSize('delete'),
      async (records, trx) => {
        const recordIds = records
          .filter((r) => !!r.id.remoteId)
          .map((r) => ({ wsId: r.id.wsId, remoteId: r.id.remoteId! }));

        await connector.deleteRecords(tableSpec, recordIds);

        // Remove them from the snapshot.
        await this.snapshotDbService.snapshotDb.deleteRecords(
          snapshot.id as SnapshotId,
          tableSpec,
          records.map((r) => r.id.wsId),
          trx,
        );
      },
      true,
    );
  }

  async clearActiveView(snapshotId: SnapshotId, tableId: string, actor: Actor): Promise<void> {
    const snapshot = await this.findOneOrThrow(snapshotId, actor);

    const snapshotTable = getSnapshotTableByWsId(snapshot, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
    }

    const tableContext = snapshotTable.tableContext as SnapshotTableContext;
    if (tableContext) {
      // set the active ID
      tableContext.activeViewId = null;

      await this.db.client.snapshotTable.update({
        where: { id: snapshotTable.id },
        data: {
          tableContext,
        },
      });
    }
  }

  async setActiveRecordsFilter(
    snapshotId: SnapshotId,
    tableId: string,
    dto: SetActiveRecordsFilterDto,
    actor: Actor,
  ): Promise<void> {
    const snapshot = await this.findOneOrThrow(snapshotId, actor);

    const snapshotTable = getSnapshotTableByWsId(snapshot, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
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

    await this.db.client.snapshotTable.update({
      where: { id: snapshotTable.id },
      data: {
        activeRecordSqlFilter: dto.sqlWhereClause,
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

  async clearActiveRecordFilter(snapshotId: SnapshotId, tableId: string, actor: Actor): Promise<void> {
    const snapshot = await this.findOneOrThrow(snapshotId, actor);
    const snapshotTable = getSnapshotTableByWsId(snapshot, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
    }

    await this.db.client.snapshotTable.update({
      where: { id: snapshotTable.id },
      data: {
        activeRecordSqlFilter: null,
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
    const snapshot = await this.db.client.snapshot.findUnique({
      where: { id: snapshotId },
      include: SnapshotCluster._validator.include,
    });

    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    const snapshotTable = getSnapshotTableByWsId(snapshot, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
    }

    await this.streamCsvExport(snapshot, snapshotTable, tableId, filteredOnly, res);
  }

  /**
   * Helper method to stream CSV export
   */
  private async streamCsvExport(
    snapshot: SnapshotCluster.Snapshot,
    snapshotTable: SnapshotTable,
    tableId: string,
    filteredOnly: boolean,
    res: Response,
  ): Promise<void> {
    try {
      // Get column names to exclude internal metadata fields
      const columnQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = '${snapshot.id}' 
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
      const sqlWhereClause = filteredOnly ? snapshotTable.activeRecordSqlFilter : null;

      // Build the WHERE clause if filter should be applied and exists
      const whereClause =
        filteredOnly && sqlWhereClause && sqlWhereClause.trim() !== '' ? ` WHERE ${sqlWhereClause}` : '';

      // Clear __dirty and __edited_fields for all records being exported (only for "Export All", not filtered)
      if (!filteredOnly) {
        await this.snapshotDbService.snapshotDb.knex(`${snapshot.id}.${tableId}`).update({
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
        schema: snapshot.id,
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

  async importSuggestions(
    snapshotId: SnapshotId,
    tableId: string,
    buffer: Buffer,
    actor: Actor,
  ): Promise<ImportSuggestionsResponseDto> {
    // Verify user has access to the snapshot
    const snapshot = await this.findOne(snapshotId, actor);
    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    // Find the table specification
    const tableSpec = getTableSpecByWsId(snapshot, tableId);
    if (!tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
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
            // Validate that wsId column exists
            if (records.length === 0) {
              throw new BadRequestException('CSV file is empty');
            }

            const firstRecord = records[0];
            if (!firstRecord['wsId']) {
              throw new BadRequestException('CSV must have a "wsId" column as the first column');
            }

            // Create a map of column names to column IDs
            const columnMap = new Map<string, string>();
            for (const column of tableSpec.columns) {
              columnMap.set(column.name, column.id.wsId);
            }

            // Process records in chunks
            for (let i = 0; i < records.length; i += chunkSize) {
              const chunk = records.slice(i, i + chunkSize);
              const operations: UpdateRecordOperation[] = [];

              for (const record of chunk) {
                const wsId = record['wsId'];
                if (!wsId) {
                  continue; // Skip records without wsId
                }

                const data: Record<string, unknown> = {};
                let hasData = false;

                // Process each column in the CSV (except wsId)
                for (const [columnName, value] of Object.entries(record)) {
                  if (columnName === 'wsId') {
                    continue; // Skip the wsId column
                  }

                  // Only include non-empty values
                  if (value && value.trim() !== '') {
                    const columnId = columnMap.get(columnName);
                    if (columnId) {
                      data[columnId] = value;
                      hasData = true;
                    } else {
                      WSLogger.warn({
                        source: 'SnapshotService.importSuggestions',
                        message: `Column "${columnName}" not found in table spec`,
                        snapshotId,
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

              // Create suggestions for this chunk
              if (operations.length > 0) {
                await this.bulkUpdateRecords(snapshotId, tableId, { ops: operations }, actor, 'suggested', undefined);
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

  async setTitleColumn(snapshotId: SnapshotId, tableId: string, columnId: string, actor: Actor): Promise<void> {
    const snapshot = await this.findOneOrThrow(snapshotId, actor);
    const snapshotTable = getSnapshotTableByWsId(snapshot, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
    }

    if (!snapshotTable.tableSpec) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
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

    this.snapshotEventService.sendSnapshotEvent(snapshotId, {
      type: 'snapshot-updated',
      data: { source: 'user', tableId },
    });

    await this.auditLogService.logEvent({
      userId: actor.userId,
      organizationId: actor.organizationId,
      eventType: 'update',
      message: `Set title column for table ${tableSpec.name} to ${column.name}`,
      entityId: snapshotId,
      context: {
        tableId,
        columnId,
        columnName: column.name,
      },
    });
  }

  async addScratchColumn(
    snapshotId: SnapshotId,
    tableId: string, // The WS Table ID
    addScratchColumnDto: AddScratchColumnDto,
    actor: Actor,
  ): Promise<void> {
    const { columnName, dataType } = addScratchColumnDto;
    const snapshot = await this.findOne(snapshotId, actor);
    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }
    const snapshotTable = getSnapshotTableByWsId(snapshot, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
    }

    const columnId = sanitizeForWsId(columnName);
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

    await this.snapshotDbService.snapshotDb.addColumn(snapshotId, tableSpec.id.wsId, {
      columnId,
      columnType: dataType,
    });

    this.snapshotEventService.sendSnapshotEvent(snapshotId, {
      type: 'snapshot-updated',
      data: { source: 'user', tableId },
    });

    await this.auditLogService.logEvent({
      userId: actor.userId,
      organizationId: actor.organizationId,
      eventType: 'update',
      message: `Added scratch column ${columnName} to table ${tableSpec.name}`,
      entityId: snapshotId,
      context: {
        tableId,
        columnId,
        columnName,
      },
    });
  }

  async removeScratchColumn(
    snapshotId: SnapshotId,
    tableId: string, // The WS Table ID
    columnId: string,
    actor: Actor,
  ): Promise<void> {
    const snapshot = await this.findOne(snapshotId, actor);
    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }
    const snapshotTable = getSnapshotTableByWsId(snapshot, tableId);
    if (!snapshotTable) {
      throw new NotFoundException(`Table ${tableId} not found in snapshot ${snapshotId}`);
    }

    const tableSpec = snapshotTable.tableSpec as AnyTableSpec;
    const column = tableSpec.columns.find((c) => c.id.wsId === columnId);
    if (!column) {
      throw new NotFoundException(`Column not found in table: ${tableSpec.name} with id: ${columnId}`);
    }

    if (!column.metadata?.scratch) {
      throw new BadRequestException(`Column ${columnId} is not a scratch column and cannot be removed`);
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

    await this.snapshotDbService.snapshotDb.removeColumn(snapshotId, tableSpec.id.wsId, columnId);

    this.snapshotEventService.sendSnapshotEvent(snapshotId, {
      type: 'snapshot-updated',
      data: { source: 'user', tableId },
    });

    await this.auditLogService.logEvent({
      userId: actor.userId,
      organizationId: actor.organizationId,
      eventType: 'update',
      message: `Removed scratch column ${column.name} from table ${tableSpec.name}`,
      entityId: snapshotId,
      context: {
        tableId,
        columnId,
        columnName: column.name,
      },
    });
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
