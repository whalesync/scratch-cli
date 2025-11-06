export enum Service {
  NOTION = 'NOTION',
  AIRTABLE = 'AIRTABLE',
  CUSTOM = 'CUSTOM',
  CSV = 'CSV',
  YOUTUBE = 'YOUTUBE',
  WORDPRESS = 'WORDPRESS',
  WEBFLOW = 'WEBFLOW',
  WIX_BLOG = 'WIX_BLOG',
}

export enum ConnectorHealthStatus {
  OK = 'OK',
  FAILED = 'FAILED',
}
export enum AuthType {
  /** @deprecated */
  API_KEY = 'API_KEY',
  OAUTH = 'OAUTH',
  USER_PROVIDED_PARAMS = 'USER_PROVIDED_PARAMS',
}

export interface ConnectorAccount {
  id: string; // ConnectorAccountId
  createdAt: string; // DateTime
  updatedAt: string; // DateTime
  userId: string; // Uuid
  service: Service;
  displayName: string;
  encryptedCredentials: Record<string, string>;
  healthStatus: ConnectorHealthStatus | null;
  healthStatusLastCheckedAt: string | null; // DateTime
  healthStatusMessage: string | null; // Message if health status is not OK
  modifier: string | null; // ID of the custom connector or other modifier entity
  extras: Record<string, unknown> | null; // Additional service-specific configuration
  authType: AuthType;
}

export interface CreateConnectorAccountDto {
  service: Service;
  userProvidedParams: Record<string, string>;
  modifier?: string; // Optional custom connector ID
  displayName?: string;
}

export interface UpdateConnectorAccountDto {
  displayName?: string;
  userProvidedParams?: Record<string, string>;
  modifier?: string; // Optional custom connector ID
  extras?: Record<string, unknown>; // Additional service-specific configuration
}

export type TestConnectionResponse = { health: 'ok' } | { health: 'error'; error: string };
