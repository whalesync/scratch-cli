import { ConnectorHealthStatus, ConnectorAccount as PrismaConnectorAccount, Service } from '@prisma/client';

export class ConnectorAccount implements PrismaConnectorAccount {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  service: Service;
  displayName: string;
  apiKey: string;
  healthStatus: ConnectorHealthStatus | null;
  healthStatusLastCheckedAt: Date | null;
  modifier: string | null;
}
