import { AuthType, ConnectorHealthStatus, ConnectorAccount as PrismaConnectorAccount, Service } from '@prisma/client';

export class ConnectorAccount implements PrismaConnectorAccount {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  service: Service;
  displayName: string;
  apiKey: string;
  authType: AuthType;
  oauthAccessToken: string | null;
  oauthRefreshToken: string | null;
  oauthExpiresAt: Date | null;
  oauthWorkspaceId: string | null;
  healthStatus: ConnectorHealthStatus | null;
  healthStatusLastCheckedAt: Date | null;
  modifier: string | null;
}
