import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { createGenericTableId } from '../types/ids';
import { CreateGenericTableDto } from './dto/create-generic-table.dto';
import { GenericTableEntity } from './entities/generic-table.entity';

@Injectable()
export class GenericTableService {
  constructor(private readonly db: DbService) {}

  async create(userId: string, createDto: CreateGenericTableDto): Promise<GenericTableEntity> {
    const genericTable = (await this.db.client.genericTable.create({
      data: {
        id: createGenericTableId(),
        name: createDto.name,
        fetch: createDto.fetch,
        mapping: createDto.mapping,
        userId,
      },
    })) as GenericTableEntity;

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
}
