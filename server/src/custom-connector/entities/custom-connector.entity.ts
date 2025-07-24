import { Prisma } from '@prisma/client';
import { CustomConnectorId } from 'src/types/ids';

export class CustomConnectorEntity {
  id: CustomConnectorId;
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

  // Table listing
  listTables?: string;
  tables?: string[];

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

  constructor(customConnector: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    pollRecords: string | null;
    mapping: Prisma.JsonValue | null;
    userId: string;
    prompt?: string | null;
    apiKey?: string | null;
    listTables?: string | null;
    tables?: string[] | null;
    fetchSchema?: string | null;
    schema?: Prisma.JsonValue | null;
    getRecord?: string | null;
    deleteRecord?: string | null;
    createRecord?: string | null;
    updateRecord?: string | null;
    pollRecordsResponse?: Prisma.JsonValue | null;
    getRecordResponse?: Prisma.JsonValue | null;
  }) {
    this.id = customConnector.id as CustomConnectorId;
    this.createdAt = customConnector.createdAt;
    this.updatedAt = customConnector.updatedAt;
    this.name = customConnector.name;
    this.pollRecords = customConnector.pollRecords;
    this.mapping = customConnector.mapping;
    this.userId = customConnector.userId;
    this.prompt = customConnector.prompt ?? undefined;
    this.apiKey = customConnector.apiKey ?? undefined;
    this.listTables = customConnector.listTables ?? undefined;
    this.tables = customConnector.tables ?? undefined;
    this.fetchSchema = customConnector.fetchSchema ?? undefined;
    this.schema = customConnector.schema ?? undefined;
    this.getRecord = customConnector.getRecord ?? undefined;
    this.deleteRecord = customConnector.deleteRecord ?? undefined;
    this.createRecord = customConnector.createRecord ?? undefined;
    this.updateRecord = customConnector.updateRecord ?? undefined;
    this.pollRecordsResponse = customConnector.pollRecordsResponse ?? undefined;
    this.getRecordResponse = customConnector.getRecordResponse ?? undefined;
  }
}
