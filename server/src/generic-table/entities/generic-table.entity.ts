import { Prisma } from '@prisma/client';
import { GenericTableId } from 'src/types/ids';

export class GenericTableEntity {
  id: GenericTableId;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  fetch: Prisma.JsonValue;
  mapping: Prisma.JsonValue;
  userId: string;

  constructor(genericTable: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    fetch: Prisma.JsonValue;
    mapping: Prisma.JsonValue;
    userId: string;
  }) {
    this.id = genericTable.id as GenericTableId;
    this.createdAt = genericTable.createdAt;
    this.updatedAt = genericTable.updatedAt;
    this.name = genericTable.name;
    this.fetch = genericTable.fetch;
    this.mapping = genericTable.mapping;
    this.userId = genericTable.userId;
  }
}
