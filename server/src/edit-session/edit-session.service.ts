import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EditSessionStatus } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import { createEditSessionId, EditSessionId } from 'src/types/ids';
import { CreateEditSessionDto } from './dto/create-edit-session.dto';
import { UpdateEditSessionDto } from './dto/update-edit-session.dto';
import { EditSession } from './entities/edit-session.entity';

@Injectable()
export class EditSessionService {
  constructor(private readonly db: DbService) {}

  async create(createEditSessionDto: CreateEditSessionDto, userId: string): Promise<EditSession> {
    const { connectorAccountId } = createEditSessionDto;

    const connectorAccount = await this.db.client.connectorAccount.findUnique({
      where: {
        id: connectorAccountId,
        userId,
      },
    });
    if (!connectorAccount) {
      throw new NotFoundException('Connector account not found');
    }

    const existingSession = await this.db.client.editSession.findFirst({
      where: {
        connectorAccountId,
        status: {
          notIn: [EditSessionStatus.DONE, EditSessionStatus.CANCELLED],
        },
      },
    });

    if (existingSession) {
      throw new ConflictException('An active edit session already exists for this connector account.');
    }

    return this.db.client.editSession.create({
      data: {
        id: createEditSessionId(),
        connectorAccountId,
      },
    });
  }

  findAll(connectorAccountId: string, userId: string): Promise<EditSession[]> {
    return this.db.client.editSession.findMany({
      where: {
        connectorAccountId,
        connectorAccount: { userId },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findOne(id: EditSessionId, userId: string): Promise<EditSession | null> {
    return this.db.client.editSession.findUnique({
      where: { id, connectorAccount: { userId } },
    });
  }

  update(id: EditSessionId, updateEditSessionDto: UpdateEditSessionDto, userId: string): Promise<EditSession> {
    return this.db.client.editSession.update({
      where: { id, connectorAccount: { userId } },
      data: {
        status: updateEditSessionDto.status,
      },
    });
  }
}
