/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConnectorAccount, Prisma } from '@prisma/client';
import { InputJsonObject } from '@prisma/client/runtime/library';
import {
  createFolderId,
  createSnapshotTableId,
  createWorkbookId,
  DataFolderId,
  FolderId,
  Service,
  SnapshotTableId,
  UpdateWorkbookDto,
  ValidatedAddTableToWorkbookDto,
  ValidatedCreateWorkbookDto,
  WorkbookId,
} from '@spinner/shared-types';
import _ from 'lodash';
import { AuditLogService } from 'src/audit/audit-log.service';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { SnapshotTableCluster, WorkbookCluster } from 'src/db/cluster-types';
import { DbService } from 'src/db/db.service';
import { WSLogger } from 'src/logger';
import { PostHogService } from 'src/posthog/posthog.service';
import { DecryptedCredentials } from 'src/remote-service/connector-account/types/encrypted-credentials.interface';
import { exceptionForConnectorError } from 'src/remote-service/connectors/error';
import { sanitizeForTableWsId } from 'src/remote-service/connectors/ids';
import { SubscriptionService } from 'src/users/subscription.service';
import { Actor } from 'src/users/types';
import { BullEnqueuerService } from 'src/worker-enqueuer/bull-enqueuer.service';
import { ConnectorAccountService } from '../remote-service/connector-account/connector-account.service';
import { Connector } from '../remote-service/connectors/connector';
import { ConnectorsService } from '../remote-service/connectors/connectors.service';
import { AnySpec, AnyTableSpec } from '../remote-service/connectors/library/custom-spec-registry';
import { BaseJsonTableSpec, PostgresColumnType, SnapshotRecord } from '../remote-service/connectors/types';
import { ScratchGitService } from '../scratch-git/scratch-git.service';
import { FolderService } from './folder.service';
import { SnapshotEventService } from './snapshot-event.service';
import type { SnapshotColumnSettingsMap } from './types';
import { getSnapshotTableById, normalizeFolderName } from './util';
import { WorkbookDbService } from './workbook-db.service';

@Injectable()
export class WorkbookService {
  constructor(
    private readonly db: DbService,
    private readonly configService: ScratchpadConfigService,
    private readonly connectorService: ConnectorsService,
    private readonly workbookDbService: WorkbookDbService,
    private readonly snapshotEventService: SnapshotEventService,
    private readonly posthogService: PostHogService,
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly bullEnqueuerService: BullEnqueuerService,
    private readonly auditLogService: AuditLogService,
    private readonly subscriptionService: SubscriptionService,
    private readonly folderService: FolderService,
    private readonly scratchGitService: ScratchGitService,
  ) {}

  async create(createWorkbookDto: ValidatedCreateWorkbookDto, actor: Actor): Promise<WorkbookCluster.Workbook> {
    const { name, tables } = createWorkbookDto;

    const workbookId = createWorkbookId();
    const tableSpecs: AnySpec[] = [];
    const tableCreateInput: Prisma.SnapshotTableUncheckedCreateWithoutWorkbookInput[] = [];
    const tableSpecToIdMap = new Map<AnySpec, SnapshotTableId>();

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

          // Poll the connector for the table spec.
          // Use JSON table spec if connector supports it (new method), otherwise use column-based spec (old method)
          const tableSpec: BaseJsonTableSpec = await connector.fetchJsonTableSpec(tableId);
          tableSpecs.push(tableSpec);

          const newTableId = createSnapshotTableId();
          const wsId = sanitizeForTableWsId(tableSpec.name);
          const tableName = `${newTableId}_${wsId}`;
          const tablePath = '/' + newTableId;

          // Folder logic: ensure structure exists. The table itself is represented by this folder.
          // Since this is a new table, we can just create the folder directly at the root.
          const folderId = createFolderId();
          await this.db.client.folder.create({
            data: {
              id: folderId,
              workbookId,
              name: newTableId,
              parentId: null,
            },
          });

          tableSpecToIdMap.set(tableSpec, newTableId);

          tableCreateInput.push({
            id: newTableId,
            connectorAccountId,
            connectorService: connectorAccount.service,
            tableSpec,
            columnSettings: {},
            tableName,
            version: 'v1',
            lock: 'pull',
            path: tablePath,
            folderId,
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

    // New version that creates the single files table for the workbook.
    await this.workbookDbService.workbookDb.createForWorkbook(newWorkbook.id as WorkbookId);

    await this.bullEnqueuerService.enqueuePullFilesJob(newWorkbook.id as WorkbookId, actor);

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

    // Initialize Git Repo
    try {
      await this.scratchGitService.initRepo(newWorkbook.id as WorkbookId);
    } catch (err) {
      WSLogger.error({
        source: 'WorkbookService.create',
        message: 'Failed to init git repo',
        error: err,
        workbookId: newWorkbook.id,
      });
    }

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

    let tableSpec: BaseJsonTableSpec;
    try {
      tableSpec = await connector.fetchJsonTableSpec(tableId);
    } catch (error) {
      throw exceptionForConnectorError(error, connector);
    }

    // 5. Create the snapshotTableId first
    const snapshotTableId = createSnapshotTableId();
    const snapshotDataTableName = `${snapshotTableId}_${tableSpec.slug}`;
    const folderName = normalizeFolderName(tableSpec.name);
    const folderPath = '/' + folderName;

    const folderId = createFolderId();
    await this.db.client.folder.create({
      data: {
        id: folderId,
        workbookId,
        name: folderName,
        parentId: null,
        path: folderPath,
      },
    });

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
        lock: 'pull',
        path: folderPath,
        folderId,
      },
      include: {
        connectorAccount: true,
      },
    });

    // 7. Start pulling records in background for this specific table only (unless skipDownload is true)
    if (!options?.skipDownload) {
      try {
        if (this.configService.getUseJobs()) {
          await this.bullEnqueuerService.enqueuePullRecordFilesJob(workbookId, actor, snapshotTableId);
        }
        WSLogger.info({
          source: 'WorkbookService.addTableToWorkbook',
          message: 'Started pulling records for newly added table',
          workbookId,
          snapshotTableId,
        });
      } catch (error) {
        WSLogger.error({
          source: 'WorkbookService.addTableToWorkbook',
          message: 'Failed to start pull job for newly added table',
          error,
          workbookId,
          snapshotTableId,
        });
        // Don't fail the addTable operation if pull fails - table was still added successfully
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

    // 3. Delete the files related to this table from the folder it belongs to
    if (snapshotTable.folderId) {
      try {
        await this.workbookDbService.workbookDb.deleteFilesInFolder(workbookId, snapshotTable.folderId as FolderId);
      } catch (error) {
        WSLogger.error({
          source: 'WorkbookService.deleteTable',
          message: 'Failed to delete folder contents',
          error,
          workbookId,
          folderId: snapshotTable.id,
        });
      }
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

    await this.workbookDbService.workbookDb.cleanupSchema(id);
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

    // Delete Git Repo
    try {
      await this.scratchGitService.deleteRepo(id);
    } catch (err) {
      WSLogger.error({
        source: 'WorkbookService.delete',
        message: 'Failed to delete git repo',
        error: err,
        workbookId: id,
      });
    }
  }

  async discardChanges(workbookId: WorkbookId, actor: Actor, path?: string): Promise<void> {
    await this.findOneOrThrow(workbookId, actor);
    await this.scratchGitService.discardChanges(workbookId, path);

    // Track event
    await this.auditLogService.logEvent({
      actor,
      eventType: 'delete',
      message: `Discarded unpublished changes in workbook${path ? ` for ${path}` : ''}`,
      entityId: workbookId,
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

  async pullFiles(id: WorkbookId, actor: Actor, dataFolderIds?: string[]): Promise<{ jobId: string }> {
    // Verify the workbook exists and the user has access
    await this.findOneOrThrow(id, actor);

    // Fetch data folders that have connectors (linked folders)
    let foldersToProcess = await this.db.client.dataFolder.findMany({
      where: {
        workbookId: id,
        connectorAccountId: { not: null },
      },
      include: {
        connectorAccount: true,
      },
    });

    // Filter to specific folders if IDs provided
    if (dataFolderIds && dataFolderIds.length > 0) {
      foldersToProcess = foldersToProcess.filter((f) => dataFolderIds.includes(f.id));
    }

    if (foldersToProcess.length === 0) {
      throw new BadRequestException('No linked data folders found to pull files from');
    }

    // Set lock='pull' for all folders before enqueuing jobs
    await this.db.client.dataFolder.updateMany({
      where: {
        id: { in: foldersToProcess.map((f) => f.id) },
      },
      data: {
        lock: 'pull',
      },
    });

    // Enqueue a pull job for each data folder
    const jobs: { id: string }[] = [];
    for (const folder of foldersToProcess) {
      const job = await this.bullEnqueuerService.enqueuePullLinkedFolderFilesJob(id, actor, folder.id as DataFolderId, {
        totalFiles: 0,
        folderId: folder.id,
        folderName: folder.name,
        connector: folder.connectorService ?? 'unknown',
        status: 'pending',
      });
      jobs.push({ id: job.id as string });
    }

    // Return the first job ID for backward compatibility
    // TODO: Consider returning all job IDs in the future
    return {
      jobId: jobs[0].id,
    };
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

  async moveFolder(
    workbookId: WorkbookId,
    folderId: string, // Using string to avoid potential type import issues, cast inside if needed
    newParentId: string | null,
    actor: Actor,
  ): Promise<void> {
    await this.findOneOrThrow(workbookId, actor);
    await this.folderService.moveFolder(workbookId, folderId as any, newParentId as any);
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
