/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DbService } from '../db/db.service';
import { createCustomConnectorId } from '../types/ids';
import { CreateCustomConnectorDto } from './dto/create-custom-connector.dto';
import { UpdateCustomConnectorDto } from './dto/update-custom-connector.dto';
import { CustomConnectorEntity } from './entities/custom-connector.entity';

@Injectable()
export class CustomConnectorService {
  constructor(private readonly db: DbService) {}

  async create(userId: string, createDto: CreateCustomConnectorDto): Promise<CustomConnectorEntity> {
    const customConnector = (await this.db.client.customConnector.create({
      data: {
        id: createCustomConnectorId(),
        name: createDto.name,
        pollRecords: createDto.pollRecords,
        mapping: createDto.mapping
          ? (JSON.parse(JSON.stringify(createDto.mapping)) as Prisma.InputJsonValue)
          : undefined,
        userId,
        prompt: createDto.prompt,
        apiKey: createDto.apiKey,
        fetchSchema: createDto.fetchSchema,
        schema: createDto.schema,
        listTables: createDto.listTables,
        tables: createDto.tables,
        getRecord: createDto.getRecord,
        deleteRecord: createDto.deleteRecord,
        createRecord: createDto.createRecord,
        updateRecord: createDto.updateRecord,
        pollRecordsResponse: createDto.pollRecordsResponse,
        getRecordResponse: createDto.getRecordResponse,
      },
    })) as CustomConnectorEntity;

    return new CustomConnectorEntity(customConnector);
  }

  async update(userId: string, id: string, updateDto: UpdateCustomConnectorDto): Promise<CustomConnectorEntity> {
    const customConnector = await this.db.client.customConnector.update({
      where: {
        id,
        userId,
      },
      data: {
        name: updateDto.name,
        pollRecords: updateDto.pollRecords,
        mapping: updateDto.mapping
          ? (JSON.parse(JSON.stringify(updateDto.mapping)) as Prisma.InputJsonValue)
          : undefined,
        prompt: updateDto.prompt,
        apiKey: updateDto.apiKey,
        fetchSchema: updateDto.fetchSchema,
        schema: updateDto.schema,
        listTables: updateDto.listTables,
        tables: updateDto.tables,
        getRecord: updateDto.getRecord,
        deleteRecord: updateDto.deleteRecord,
        createRecord: updateDto.createRecord,
        updateRecord: updateDto.updateRecord,
        pollRecordsResponse: updateDto.pollRecordsResponse,
        getRecordResponse: updateDto.getRecordResponse,
      },
    });

    return new CustomConnectorEntity(customConnector);
  }

  async findAllByUserId(userId: string): Promise<CustomConnectorEntity[]> {
    const customConnectors = await this.db.client.customConnector.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return customConnectors.map((connector) => new CustomConnectorEntity(connector));
  }

  async findOne(userId: string, id: string): Promise<CustomConnectorEntity> {
    const customConnector = await this.db.client.customConnector.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!customConnector) {
      throw new Error('Custom connector not found');
    }

    return new CustomConnectorEntity(customConnector);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db.client.customConnector.delete({
      where: {
        id,
        userId,
      },
    });
  }
}
