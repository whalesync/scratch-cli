import { Injectable, NotFoundException } from '@nestjs/common';
import { Connection } from '@prisma/client';
import { DbService } from '../db/db.service';
import { createConnectionId } from '../types/ids';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';

@Injectable()
export class ConnectionsService {
  constructor(private readonly db: DbService) {}

  async ensureFakeUserExists(userId: string): Promise<void> {
    await this.db.client.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });
  }

  async create(createConnectionDto: CreateConnectionDto, userId: string): Promise<Connection> {
    return this.db.client.connection.create({
      data: {
        id: createConnectionId(),
        userId,
        service: createConnectionDto.service,
        displayName: `New ${createConnectionDto.service} connection`,
        apiKey: createConnectionDto.apiKey,
      },
    });
  }

  async findAll(userId: string): Promise<Connection[]> {
    return this.db.client.connection.findMany({
      where: { userId },
    });
  }

  async findOne(id: string, userId: string): Promise<Connection> {
    const connection = await this.db.client.connection.findUnique({
      where: { id, userId },
    });
    if (!connection) {
      throw new NotFoundException('Connection not found');
    }
    return connection;
  }

  async update(id: string, updateConnectionDto: UpdateConnectionDto, userId: string): Promise<Connection> {
    return this.db.client.connection.update({
      where: { id, userId },
      data: updateConnectionDto,
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.db.client.connection.delete({
      where: { id, userId },
    });
  }
}
