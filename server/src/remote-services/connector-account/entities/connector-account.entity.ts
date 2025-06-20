import { ConnectorAccount as PrismaConnectorAccount, Service } from '@prisma/client';

export class ConnectorAccount implements PrismaConnectorAccount {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  service: Service;
  displayName: string;
  apiKey: string;
}
