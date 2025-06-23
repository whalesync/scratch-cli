import { Injectable, NotFoundException } from '@nestjs/common';
import { Snapshot } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import { ConnectorAccount } from 'src/remote-service/connector-account/entities/connector-account.entity';
import { createSnapshotId, SnapshotId } from 'src/types/ids';
import { TablePath } from '../remote-service/connector-account/entities/table-list.entity';
import { ConnectorsService } from '../remote-service/connectors/connectors.service';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { UpdateSnapshotDto } from './dto/update-snapshot.dto';

type SnapshotWithConnectorAccount = Snapshot & { connectorAccount: ConnectorAccount };

@Injectable()
export class SnapshotService {
  constructor(
    private readonly db: DbService,
    private readonly connectorService: ConnectorsService,
  ) {}

  async create(createSnapshotDto: CreateSnapshotDto, userId: string): Promise<Snapshot> {
    const { connectorAccountId, tablePaths } = createSnapshotDto;

    const connectorAccount = await this.db.client.connectorAccount.findUnique({
      where: {
        id: connectorAccountId,
        userId,
      },
    });
    if (!connectorAccount) {
      throw new NotFoundException('Connector account not found');
    }

    return this.db.client.snapshot.create({
      data: {
        id: createSnapshotId(),
        connectorAccountId,
        tablePaths,
      },
    });
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

  async update(id: SnapshotId, updateSnapshotDto: UpdateSnapshotDto, userId: string): Promise<Snapshot> {
    const snapshot = await this.findOne(id, userId);
    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }
    return snapshot;
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
    const tablePaths = snapshot.tablePaths as TablePath[];
    for (const tablePath of tablePaths) {
      // TODO: Actually download the table.
      console.log('Pretending to download table', tablePath, 'for connector', connector.service);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log('Done downloading snapshot', snapshot.id);
  }
}
