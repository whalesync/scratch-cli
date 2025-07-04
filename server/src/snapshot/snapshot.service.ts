import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Service, SnapshotTableView } from '@prisma/client';
import { SnapshotCluster } from 'src/db/cluster-types';
import { DbService } from 'src/db/db.service';
import { createSnapshotId, createSnapshotTableViewId, SnapshotId } from 'src/types/ids';
import { Connector } from '../remote-service/connectors/connector';
import { ConnectorsService } from '../remote-service/connectors/connectors.service';
import { AnyTableSpec, TableSpecs } from '../remote-service/connectors/library/custom-spec-registry';
import { PostgresColumnType, SnapshotRecord } from '../remote-service/connectors/types';
import { CreateSnapshotTableViewDto } from './dto/activate-view.dto';
import { BulkUpdateRecordsDto, RecordOperation } from './dto/bulk-update-records.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { UpdateSnapshotDto } from './dto/update-snapshot.dto';
import { SnapshotDbService } from './snapshot-db.service';
import { SnapshotTableContext, SnapshotTableViewConfig } from './types';

type SnapshotWithConnectorAccount = SnapshotCluster.Snapshot;

@Injectable()
export class SnapshotService {
  constructor(
    private readonly db: DbService,
    private readonly connectorService: ConnectorsService,
    private readonly snapshotDbService: SnapshotDbService,
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
      console.error(`Error downloading snapshot ${newSnapshot.id}:`, error);
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

    let viewConfig: SnapshotTableViewConfig | undefined = undefined;

    if (viewId) {
      const view = await this.db.client.snapshotTableView.findUnique({
        where: { id: viewId },
      });
      if (view) {
        viewConfig = view.config as SnapshotTableViewConfig;
      }
    }

    const records = await this.snapshotDbService.listRecords(snapshotId, tableId, cursor, take + 1, viewConfig);

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

  async bulkUpdateRecords(
    snapshotId: SnapshotId,
    tableId: string,
    dto: BulkUpdateRecordsDto,
    userId: string,
  ): Promise<void> {
    const snapshot = await this.findOneWithConnectorAccount(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as AnyTableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    this.validateBulkUpdateOps(dto.ops, tableSpec);

    return this.snapshotDbService.bulkUpdateRecords(snapshotId, tableId, dto.ops);
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
      console.error(`Error downloading snapshot ${id}:`, error);
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
    console.log('Done downloading snapshot', snapshot.id);
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

    console.log('Done publishing snapshot', snapshot.id);
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
