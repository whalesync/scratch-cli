export enum Service {
  NOTION = "NOTION",
  AIRTABLE = "AIRTABLE",
}

export interface ConnectorAccount {
  id: string; // ConnectorAccountId
  createdAt: string; // DateTime
  updatedAt: string; // DateTime
  userId: string; // Uuid
  service: Service;
  displayName: string;
  apiKey: string;
}

export interface CreateConnectorAccountDto {
  service: Service;
  apiKey: string;
}

export interface UpdateConnectorAccountDto {
  displayName?: string;
  apiKey?: string;
}

export type TestConnectionResponse =
  | { health: "ok" }
  | { health: "error"; error: string };
