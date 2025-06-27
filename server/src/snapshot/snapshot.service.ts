import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Snapshot } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import { ConnectorAccount } from 'src/remote-service/connector-account/entities/connector-account.entity';
import { createSnapshotId, SnapshotId } from 'src/types/ids';
import { ConnectorsService } from '../remote-service/connectors/connectors.service';
import { PostgresColumnType, SnapshotRecord, TableSpec } from '../remote-service/connectors/types';
import { BulkUpdateRecordsDto, RecordOperation } from './dto/bulk-update-records.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { UpdateSnapshotDto } from './dto/update-snapshot.dto';
import { SnapshotDbService } from './snapshot-db.service';

type SnapshotWithConnectorAccount = Snapshot & { connectorAccount: ConnectorAccount };

@Injectable()
export class SnapshotService {
  constructor(
    private readonly db: DbService,
    private readonly connectorService: ConnectorsService,
    private readonly snapshotDbService: SnapshotDbService,
  ) {}

  async create(createSnapshotDto: CreateSnapshotDto, userId: string): Promise<Snapshot> {
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
    const tableSpecs: TableSpec[] = [];
    for (const tableId of tableIds) {
      tableSpecs.push(await connector.fetchTableSpec(tableId));
    }

    // Create the entity in the DB.
    const newSnapshot = await this.db.client.snapshot.create({
      data: {
        id: createSnapshotId(),
        connectorAccountId,
        tableSpecs,
      },
      include: { connectorAccount: true },
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

  findAll(connectorAccountId: string, userId: string): Promise<Snapshot[]> {
    return this.db.client.snapshot.findMany({
      where: {
        connectorAccountId,
        connectorAccount: { userId },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findOne(id: SnapshotId, userId: string): Promise<Snapshot | null> {
    return this.db.client.snapshot.findUnique({
      where: { id, connectorAccount: { userId } },
    });
  }

  private async findOneAsUser(id: SnapshotId, userId: string): Promise<Snapshot> {
    const snapshot = await this.findOne(id, userId);
    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }
    return snapshot;
  }

  async update(id: SnapshotId, updateSnapshotDto: UpdateSnapshotDto, userId: string): Promise<Snapshot> {
    const snapshot = await this.findOneAsUser(id, userId);
    return snapshot;
  }

  async listRecords(
    snapshotId: SnapshotId,
    tableId: string,
    userId: string,
    cursor: string | undefined,
    take: number,
  ): Promise<{ records: SnapshotRecord[]; nextCursor?: string }> {
    const snapshot = await this.findOneAsUser(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as TableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    const records = await this.snapshotDbService.listRecords(snapshotId, tableId, cursor, take + 1);

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
    const snapshot = await this.findOneAsUser(snapshotId, userId);
    const tableSpec = (snapshot.tableSpecs as TableSpec[]).find((t) => t.id.wsId === tableId);
    if (!tableSpec) {
      throw new NotFoundException('Table not found in snapshot');
    }

    this.validateBulkUpdateOps(dto.ops, tableSpec);

    return this.snapshotDbService.bulkUpdateRecords(snapshotId, tableId, dto.ops);
  }

  private validateBulkUpdateOps(ops: RecordOperation[], tableSpec: TableSpec) {
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
    const snapshot: SnapshotWithConnectorAccount | null = await this.db.client.snapshot.findUnique({
      where: { id, connectorAccount: { userId } },
      include: { connectorAccount: true },
    });

    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    // TODO: Do this work somewhere real.
    this.downloadSnapshotInBackground(snapshot).catch((error) => {
      console.error(`Error downloading snapshot ${id}:`, error);
    });
  }

  private async downloadSnapshotInBackground(snapshot: SnapshotWithConnectorAccount): Promise<void> {
    const connector = this.connectorService.getConnector(snapshot.connectorAccount);
    const tableSpecs = snapshot.tableSpecs as TableSpec[];
    for (const tableSpec of tableSpecs) {
      await connector.downloadTableRecords(
        tableSpec,
        async (records) => await this.snapshotDbService.upsertRecords(snapshot.id as SnapshotId, tableSpec, records),
      );
    }
    console.log('Done downloading snapshot', snapshot.id);
  }

  async delete(id: SnapshotId, userId: string): Promise<void> {
    await this.findOneAsUser(id, userId);

    await this.snapshotDbService.cleanUpSnapshot(id);
    await this.db.client.snapshot.delete({
      where: { id },
    });
  }
}
