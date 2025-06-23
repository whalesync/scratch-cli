import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { createSnapshotId, SnapshotId } from 'src/types/ids';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { UpdateSnapshotDto } from './dto/update-snapshot.dto';
import { Snapshot } from './entities/snapshot.entity';

@Injectable()
export class SnapshotService {
  constructor(private readonly db: DbService) {}

  async create(createSnapshotDto: CreateSnapshotDto, userId: string): Promise<Snapshot> {
    const { connectorAccountId } = createSnapshotDto;

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
}
