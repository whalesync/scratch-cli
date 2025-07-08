import { Prisma } from '@prisma/client';
import { GenericTableId } from 'src/types/ids';

export class GenericTableEntity {
  id: GenericTableId;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  pollRecords: string | null;
  mapping: Prisma.JsonValue | null;
  userId: string;

  // AI generation prompt
  prompt?: string;

  // API key for external services
  apiKey?: string;

  // Schema generation
  fetchSchema?: string;
  schema?: Prisma.JsonValue;

  // CRUD operation function bodies
  getRecord?: string;
  deleteRecord?: string;
  createRecord?: string;
  updateRecord?: string;

  // Response schemas
  pollRecordsResponse?: Prisma.JsonValue;
  getRecordResponse?: Prisma.JsonValue;

  constructor(genericTable: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    pollRecords: string | null;
    mapping: Prisma.JsonValue | null;
    userId: string;
    prompt?: string | null;
    apiKey?: string | null;
    fetchSchema?: string | null;
    schema?: Prisma.JsonValue | null;
    getRecord?: string | null;
    deleteRecord?: string | null;
    createRecord?: string | null;
    updateRecord?: string | null;
    pollRecordsResponse?: Prisma.JsonValue | null;
    getRecordResponse?: Prisma.JsonValue | null;
  }) {
    this.id = genericTable.id as GenericTableId;
    this.createdAt = genericTable.createdAt;
    this.updatedAt = genericTable.updatedAt;
    this.name = genericTable.name;
    this.pollRecords = genericTable.pollRecords;
    this.mapping = genericTable.mapping;
    this.userId = genericTable.userId;
    this.prompt = genericTable.prompt ?? undefined;
    this.apiKey = genericTable.apiKey ?? undefined;
    this.fetchSchema = genericTable.fetchSchema ?? undefined;
    this.schema = genericTable.schema ?? undefined;
    this.getRecord = genericTable.getRecord ?? undefined;
    this.deleteRecord = genericTable.deleteRecord ?? undefined;
    this.createRecord = genericTable.createRecord ?? undefined;
    this.updateRecord = genericTable.updateRecord ?? undefined;
    this.pollRecordsResponse = genericTable.pollRecordsResponse ?? undefined;
    this.getRecordResponse = genericTable.getRecordResponse ?? undefined;
  }
}
