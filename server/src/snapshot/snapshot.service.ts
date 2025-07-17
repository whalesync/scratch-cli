import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Service, SnapshotTableView } from '@prisma/client';
import { SnapshotCluster } from 'src/db/cluster-types';
import { DbService } from 'src/db/db.service';
import { WSLogger } from 'src/logger';
import { createSnapshotId, createSnapshotTableViewId, SnapshotId } from 'src/types/ids';
import { ViewConfig, ViewTableConfig } from 'src/view/types';
import { Connector } from '../remote-service/connectors/connector';
import { ConnectorsService } from '../remote-service/connectors/connectors.service';
import { AnyTableSpec, TableSpecs } from '../remote-service/connectors/library/custom-spec-registry';
import { PostgresColumnType, SnapshotRecord } from '../remote-service/connectors/types';
import { CreateSnapshotTableViewDto } from './dto/activate-view.dto';
import { BulkUpdateRecordsDto, RecordOperation } from './dto/bulk-update-records.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { UpdateSnapshotDto } from './dto/update-snapshot.dto';
import { SnapshotDbService } from './snapshot-db.service';
import { SnapshotEventService } from './snapshot-event.service';
import { SnapshotTableContext } from './types';

type SnapshotWithConnectorAccount = SnapshotCluster.Snapshot;

@Injectable()
export class SnapshotService {
  constructor(
    private readonly db: DbService,
    private readonly connectorService: ConnectorsService,
    private readonly snapshotDbService: SnapshotDbService,
    private readonly snapshotEventService: SnapshotEventService,
  ) {}

  async create(createSnapshotDto: CreateSnapshotDto, userId: string): Promise<SnapshotCluster.Snapshot> {
    const { connectorAccountId, tableIds } = createSnapshotDto;

    const connectorAccount = await this.db.client.connectorAccount.findUnique({
      where: {
        id: connectorAccountId,
        userId,
      },
    });
    if (!connectorAccount) {
      throw new NotFoundException('Connector account not found');
    }

    // Poll the connector for the set of columns.
    // This probably could be something the user selects, which would mean we poll for it earlier and just take the
    // results back here.
    const connector = this.connectorService.getConnector(connectorAccount);
    const tableSpecs: AnyTableSpec[] = [];
    const tableContexts: SnapshotTableContext[] = [];
    for (const tableId of tableIds) {
      tableSpecs.push(await connector.fetchTableSpec(tableId));
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
        connectorAccountId,
        name: createSnapshotDto.name,
        tableSpecs,
        tableContexts,
      },
      include: SnapshotCluster._validator.include,
    });

    // Make a new schema and create tables to store its data.
    await this.snapshotDbService.createForSnapshot(newSnapshot.id as SnapshotId, tableSpecs);

    // Start downloading in the background
    // TODO: Do this work somewhere real.
    this.downloadSnapshotInBackground(newSnapshot).catch((error) => {
      WSLogger.error({
        source: 'SnapshotService.create',
        message: 'Error downloading snapshot',
        snapshotId: newSnapshot.id,
        error,
      });
    });

    return newSnapshot;
  }

  async delete(id: SnapshotId, userId: string): Promise<void> {
    await this.findOneWithConnectorAccount(id, userId); // Permissions

    await this.snapshotDbService.cleanUpSnapshot(id);
    await this.db.client.snapshot.delete({
      where: { id },
    });
  }

  findAll(connectorAccountId: string, userId: string): Promise<SnapshotCluster.Snapshot[]> {
    return this.db.client.snapshot.findMany({
      where: {
        connectorAccountId,
        connectorAccount: { userId },
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
        connectorAccount: { userId },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: SnapshotCluster._validator.include,
    });
  }

  findOne(id: SnapshotId, userId: string): Promise<SnapshotCluster.Snapshot | null> {
    return this.db.client.snapshot.findUnique({
      where: { id, connectorAccount: { userId } },
      include: SnapshotCluster._validator.include,
    });
  }

  private async findOneWithConnectorAccount(id: SnapshotId, userId: string): Promise<SnapshotWithConnectorAccount> {
    const snapshot = await this.db.client.snapshot.findUnique({
      where: { id, connectorAccount: { userId } },
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
    const snapshot = await this.findOneWithConnectorAccount(id, userId);
    // TODO: Update the snapshot if there's anything in the DTO.
    return snapshot;
  }

  async listRecords(
    snapshotId: SnapshotId,
    tableId: string,
    userId: string,
    cursor: string | undefined,
    take: number,
    viewId: string | undefined,
  ): Promise<{ records: SnapshotRecord[]; nextCursor?: string }> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    let viewConfig: ViewConfig | undefined = undefined;

    if (viewId) {
      const view = await this.db.client.view.findUnique({
        where: { id: viewId },
      });
      if (view) {
        viewConfig = view.config as ViewConfig;
      }
    }

    const records = await this.snapshotDbService.listRecords(
      snapshotId,
      tableId,
      cursor,
      take + 1,
      viewConfig,
      tableSpec,
    );

    let nextCursor: string | undefined;
    if (records.length === take + 1) {
      const nextRecord = records.pop();
      nextCursor = nextRecord!.id.wsId;
    }

    return {
      records,
      nextCursor,
    };
  }

  /**
   * List records for the active view of a table. If there is no active view, it will return records from the entire table.
   */
  // async listActiveViewRecords(
  //   snapshotId: SnapshotId,
  //   tableId: string,
  //   userId: string,
  //   cursor: string | undefined,
  //   take: number,
  // ): Promise<{ records: SnapshotRecord[]; nextCursor?: string }> {
  //   const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
  //   const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
  //   if (!tableSpec) {
  //     throw new NotFoundException('Table not found in snapshot');
  //   }

  //   const tableContext = (snapshot.tableContexts as SnapshotTableContext[]).find((c) => c.id.wsId === tableId);
  //   if (!tableContext) {
  //     throw new NotFoundException('Table context not found in snapshot');
  //   }

  //   let viewConfig: SnapshotTableViewConfig | undefined = undefined;

  //   if (tableContext.activeViewId) {
  //     const view = await this.db.client.snapshotTableView.findUnique({
  //       where: { id: tableContext.activeViewId },
  //     });
  //     if (view) {
  //       viewConfig = view.config as SnapshotTableViewConfig;
  //     }
  //   }

  //   const records = await this.snapshotDbService.listRecords(
  //     snapshotId,
  //     tableId,
  //     cursor,
  //     take + 1,
  //     viewConfig,
  //     tableSpec,
  //   );

  //   let nextCursor: string | undefined;
  //   if (records.length === take + 1) {
  //     const nextRecord = records.pop();
  //     nextCursor = nextRecord!.id.wsId;
  //   }

  //   return {
  //     records,
  //     nextCursor,
  //   };
  // }

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
      const view = await this.db.client.view.findUnique({
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

    return this.snapshotDbService.bulkUpdateRecords(snapshotId, tableId, filteredOps, type);
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
    // First check if the record is visible
    if (op.op !== 'update' || !this.isRecordVisible(op.wsId, tableViewConfig)) {
      return false;
    }

    // Then check if the columns being updated are visible
    if (!op.data) return true;

    const visibleColumns = this.getVisibleColumns(tableViewConfig, tableSpec);
    const requestedColumns = Object.keys(op.data);

    // Check if all requested columns are visible
    return requestedColumns.every((column) => visibleColumns.includes(column));
  }

  private isDeleteOperationAllowed(op: RecordOperation, tableViewConfig: ViewTableConfig): boolean {
    // For delete operations, we only need to check if the record is visible
    if (op.op !== 'delete') return true;
    return this.isRecordVisible(op.wsId, tableViewConfig);
  }

  private isRecordVisible(wsId: string, tableViewConfig: ViewTableConfig): boolean {
    if (tableViewConfig.visible === false) {
      // In exclude mode, record is visible if it's explicitly marked as visible
      return tableViewConfig.records?.some((r) => r.wsId === wsId && r.visible === true) || false;
    } else {
      // In include mode, record is visible if it's not explicitly marked as hidden
      return !(tableViewConfig.records?.some((r) => r.wsId === wsId && r.visible === false) || false);
    }
  }

  private getVisibleColumns(tableViewConfig: ViewTableConfig, tableSpec: AnyTableSpec): string[] {
    const allColumns = tableSpec.columns.map((c) => c.id.wsId);

    if (tableViewConfig.visible === false) {
      // In exclude mode, columns are visible if they're explicitly marked as visible
      return tableViewConfig.columns?.filter((c) => c.visible === true).map((c) => c.wsId) ?? [];
    } else {
      // In include mode, columns are visible if they're not explicitly marked as hidden
      const hiddenColumns = tableViewConfig.columns?.filter((c) => c.visible === false).map((c) => c.wsId) ?? [];
      return allColumns.filter((col) => !hiddenColumns.includes(col));
    }
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

    return this.snapshotDbService.acceptCellValues(snapshotId, tableId, items);
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

    return this.snapshotDbService.rejectValues(snapshotId, tableId, items);
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

  async download(id: SnapshotId, userId: string): Promise<void> {
    const snapshot = await this.findOneWithConnectorAccount(id, userId);

    // TODO: Do this work somewhere real.
    this.downloadSnapshotInBackground(snapshot).catch((error) => {
      WSLogger.error({
        source: 'SnapshotService.download',
        message: 'Error downloading snapshot',
        snapshotId: id,
        error,
      });
    });
  }

  private async downloadSnapshotInBackground(snapshot: SnapshotWithConnectorAccount): Promise<void> {
    const connector = this.connectorService.getConnector(snapshot.connectorAccount);
    const tableSpecs = snapshot.tableSpecs as AnyTableSpec[];
    for (const tableSpec of tableSpecs) {
      await connector.downloadTableRecords(
        tableSpec,
        async (records) => await this.snapshotDbService.upsertRecords(snapshot.id as SnapshotId, tableSpec, records),
      );
    }
    WSLogger.debug({
      source: 'SnapshotService.downloadSnapshotInBackground',
      message: 'Done downloading snapshot',
      snapshotId: snapshot.id,
    });
  }

  async publish(id: SnapshotId, userId: string): Promise<void> {
    const snapshot = await this.findOneWithConnectorAccount(id, userId);
    // TODO: Do this work somewhere real.
    // For now it's running synchronously, but could also be done in the background.
    await this.publishSnapshot(snapshot);
  }

  private async publishSnapshot(snapshot: SnapshotWithConnectorAccount): Promise<void> {
    const connector = this.connectorService.getConnector(snapshot.connectorAccount);
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
    await this.snapshotDbService.forAllDirtyRecords(
      snapshot.id as SnapshotId,
      tableSpec.id.wsId,
      'create',
      connector.getBatchSize('create'),
      async (records) => {
        const sanitizedRecords = records
          .map((record) => filterToOnlyEditedKnownFields(record, tableSpec))
          .map((r) => ({ wsId: r.id.wsId, fields: r.fields }));

        const returnedRecords = await connector.createRecords(tableSpec, sanitizedRecords);
        // Save the created IDs.
        await this.snapshotDbService.updateRemoteIds(snapshot.id as SnapshotId, tableSpec, returnedRecords);
      },
    );
  }

  private async publishUpdatesToTable<S extends Service>(
    snapshot: SnapshotWithConnectorAccount,
    connector: Connector<S>,
    tableSpec: TableSpecs[S],
  ): Promise<void> {
    // Then apply updates since it might depend on the created IDs, and clear out FKs to the deleted records.
    await this.snapshotDbService.forAllDirtyRecords(
      snapshot.id as SnapshotId,
      tableSpec.id.wsId,
      'update',
      connector.getBatchSize('update'),
      async (records) => {
        const sanitizedRecords = records
          .map((record) => filterToOnlyEditedKnownFields(record, tableSpec))
          .map((r) => ({
            id: { wsId: r.id.wsId, remoteId: r.id.remoteId! },
            partialFields: r.fields,
          }));

        await connector.updateRecords(tableSpec, sanitizedRecords);
      },
    );
  }

  private async publishDeletesToTable<S extends Service>(
    snapshot: SnapshotWithConnectorAccount,
    connector: Connector<S>,
    tableSpec: TableSpecs[S],
  ): Promise<void> {
    // Finally the deletes since hopefully nothing references them.
    await this.snapshotDbService.forAllDirtyRecords(
      snapshot.id as SnapshotId,
      tableSpec.id.wsId,
      'delete',
      connector.getBatchSize('delete'),
      async (records) => {
        const recordIds = records
          .filter((r) => !!r.id.remoteId)
          .map((r) => ({ wsId: r.id.wsId, remoteId: r.id.remoteId! }));

        await connector.deleteRecords(tableSpec, recordIds);

        // Remove them from the snapshot.
        await this.snapshotDbService.deleteRecords(
          snapshot.id as SnapshotId,
          tableSpec,
          records.map((r) => r.id.wsId),
        );
      },
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

  async activateView(
    snapshotId: SnapshotId,
    tableId: string, // wsId for the table
    dto: CreateSnapshotTableViewDto,
    userId: string,
  ): Promise<SnapshotTableView> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    const config = { ids: dto.recordIds };

    const view = await this.db.client.snapshotTableView.upsert({
      where: { snapshotId_tableId: { snapshotId, tableId } },
      update: { source: dto.source, config },
      create: {
        id: createSnapshotTableViewId(),
        snapshotId,
        tableId,
        source: dto.source,
        name: dto.name,
        config,
      },
    });

    const contexts = snapshot.tableContexts as SnapshotTableContext[];

    const tableContext = contexts.find((c) => c.id.wsId === tableId);
    if (tableContext) {
      // set the active ID
      tableContext.activeViewId = view.id;

      await this.db.client.snapshot.update({
        where: { id: snapshotId },
        data: {
          tableContexts: contexts,
        },
      });
    }

    return view;
  }

  async listViews(snapshotId: SnapshotId, tableId: string, userId: string): Promise<SnapshotTableView[]> {
    await this.verifiySnapshotAndTable(snapshotId, tableId, userId);

    const results = await this.db.client.snapshotTableView.findMany({
      where: { snapshotId, tableId },
    });

    return results;
  }

  async deleteView(snapshotId: SnapshotId, tableId: string, viewId: string, userId: string): Promise<void> {
    await this.verifiySnapshotAndTable(snapshotId, tableId, userId);
    const view = await this.db.client.snapshotTableView.findUnique({
      where: { id: viewId },
    });
    if (!view || view.snapshotId !== snapshotId || view.tableId !== tableId) {
      throw new NotFoundException('View not found');
    }
    await this.db.client.snapshotTableView.delete({
      where: { id: viewId },
    });
  }

  async getView(snapshotId: SnapshotId, tableId: string, viewId: string, userId: string): Promise<SnapshotTableView> {
    await this.verifiySnapshotAndTable(snapshotId, tableId, userId);
    const view = await this.db.client.snapshotTableView.findUnique({
      where: { id: viewId },
    });
    if (!view || view.snapshotId !== snapshotId || view.tableId !== tableId) {
      throw new NotFoundException('View not found');
    }
    return view;
  }

  private async verifiySnapshotAndTable(snapshotId: SnapshotId, tableId: string, userId: string): Promise<void> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
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
