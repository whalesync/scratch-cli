import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DbService } from '../db/db.service';
import { createGenericTableId } from '../types/ids';
import { CreateGenericTableDto } from './dto/create-generic-table.dto';
import { UpdateGenericTableDto } from './dto/update-generic-table.dto';
import { GenericTableEntity } from './entities/generic-table.entity';

@Injectable()
export class GenericTableService {
  constructor(private readonly db: DbService) {}

  async create(userId: string, createDto: CreateGenericTableDto): Promise<GenericTableEntity> {
    const genericTable = (await this.db.client.genericTable.create({
      data: {
        id: createGenericTableId(),
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
        getRecord: createDto.getRecord,
        deleteRecord: createDto.deleteRecord,
        createRecord: createDto.createRecord,
        updateRecord: createDto.updateRecord,
        pollRecordsResponse: createDto.pollRecordsResponse,
        getRecordResponse: createDto.getRecordResponse,
      },
    })) as GenericTableEntity;

    return new GenericTableEntity(genericTable);
  }

  async update(userId: string, id: string, updateDto: UpdateGenericTableDto): Promise<GenericTableEntity> {
    const genericTable = await this.db.client.genericTable.update({
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
        getRecord: updateDto.getRecord,
        deleteRecord: updateDto.deleteRecord,
        createRecord: updateDto.createRecord,
        updateRecord: updateDto.updateRecord,
        pollRecordsResponse: updateDto.pollRecordsResponse,
        getRecordResponse: updateDto.getRecordResponse,
      },
    });

    return new GenericTableEntity(genericTable);
  }

  async findAllByUserId(userId: string): Promise<GenericTableEntity[]> {
    const genericTables = await this.db.client.genericTable.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return genericTables.map((table) => new GenericTableEntity(table));
  }

  async findOne(userId: string, id: string): Promise<GenericTableEntity> {
    const genericTable = await this.db.client.genericTable.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!genericTable) {
      throw new Error('Generic table not found');
    }

    return new GenericTableEntity(genericTable);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db.client.genericTable.delete({
      where: {
        id,
        userId,
      },
    });
  }
}
