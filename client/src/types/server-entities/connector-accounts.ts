export enum Service {
  NOTION = "NOTION",
  AIRTABLE = "AIRTABLE",
  CUSTOM = "CUSTOM",
  CSV = "CSV",
  YOUTUBE = "YOUTUBE",
}

export enum ConnectorHealthStatus {
  OK = "OK",
  FAILED = "FAILED",
}

export interface ConnectorAccount {
  id: string; // ConnectorAccountId
  createdAt: string; // DateTime
  updatedAt: string; // DateTime
  userId: string; // Uuid
  service: Service;
  displayName: string;
  apiKey: string;
  healthStatus: ConnectorHealthStatus | null;
  healthStatusLastCheckedAt: string | null; // DateTime
  modifier: string | null; // ID of the custom connector or other modifier entity
  extras: Record<string, unknown> | null; // Additional service-specific configuration
}

export interface CreateConnectorAccountDto {
  service: Service;
  apiKey: string;
  modifier?: string; // Optional custom connector ID
}

export interface UpdateConnectorAccountDto {
  displayName?: string;
  apiKey?: string;
  modifier?: string; // Optional custom connector ID
  extras?: Record<string, unknown>; // Additional service-specific configuration
}

export type TestConnectionResponse =
  | { health: "ok" }
  | { health: "error"; error: string };
