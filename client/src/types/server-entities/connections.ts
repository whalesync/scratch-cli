export enum Service {
  NOTION = "NOTION",
  AIRTABLE = "AIRTABLE",
}

export interface Connection {
  id: string; // ConnectionId
  createdAt: string; // DateTime
  updatedAt: string; // DateTime
  userId: string; // Uuid
  service: Service;
  displayName: string;
  apiKey: string;
}

export interface CreateConnectionDto {
  service: Service;
  apiKey: string;
}

export interface UpdateConnectionDto {
  displayName?: string;
  apiKey?: string;
}
