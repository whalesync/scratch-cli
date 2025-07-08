import { PostgresColumnType } from "./snapshot";

export interface MappingField {
  path: string;
  type: string;
  name: string;
}

export interface MappingConfig {
  recordArrayPath: string;
  idPath?: string;
  fields: MappingField[];
}

export interface GenericTableSchemaField {
  id: string;
  displayName: string;
  type: PostgresColumnType;
}

export interface GenericTable {
  id: string; // GenericTableId
  createdAt: string; // DateTime
  updatedAt: string; // DateTime
  name: string;
  pollRecords: string | null;
  mapping: MappingConfig | null;
  userId: string; // UserId

  // AI generation prompt
  prompt?: string | null;

  // API key for external services
  apiKey?: string | null;

  // Schema generation
  fetchSchema?: string | null;
  schema?: GenericTableSchemaField[] | null;

  // CRUD operation function bodies
  getRecord?: string | null;
  deleteRecord?: string | null;
  createRecord?: string | null;
  updateRecord?: string | null;

  // Response schemas
  pollRecordsResponse?: Record<string, unknown> | null;
  getRecordResponse?: Record<string, unknown> | null;
}

export interface CreateGenericTableDto {
  name: string;
  pollRecords?: string;
  mapping?: MappingConfig;

  // AI generation prompt
  prompt?: string;

  // API key for external services
  apiKey?: string;

  // Schema generation
  fetchSchema?: string;
  schema?: Record<string, unknown>;

  // CRUD operation function bodies
  getRecord?: string;
  deleteRecord?: string;
  createRecord?: string;
  updateRecord?: string;

  // Response schemas
  pollRecordsResponse?: Record<string, unknown>;
  getRecordResponse?: Record<string, unknown>;
} 