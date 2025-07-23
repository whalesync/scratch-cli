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

export interface CustomConnectorSchemaField {
  id: string;
  displayName: string;
  type: PostgresColumnType;
}

export interface CustomConnector {
  id: string; // CustomConnectorId
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

  // Table listing
  listTables?: string | null;
  tables?: string[] | null;

  // Schema generation
  fetchSchema?: string | null;
  schema?: CustomConnectorSchemaField[] | null;

  // CRUD operation function bodies
  getRecord?: string | null;
  deleteRecord?: string | null;
  createRecord?: string | null;
  updateRecord?: string | null;

  // Response schemas
  pollRecordsResponse?: Record<string, unknown> | null;
  getRecordResponse?: Record<string, unknown> | null;
}

export interface CreateCustomConnectorDto {
  name: string;
  pollRecords?: string;
  mapping?: MappingConfig;

  // AI generation prompt
  prompt?: string;

  // API key for external services
  apiKey?: string;

  // Table listing
  listTables?: string;
  tables?: string[];

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