import { AuthType, ConnectorHealthStatus, ConnectorAccount as PrismaConnectorAccount, Service } from '@prisma/client';
import { DecryptedCredentials } from '../types/encrypted-credentials.interface';

export class ConnectorAccount implements PrismaConnectorAccount {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  service: Service;
  displayName: string;
  authType: AuthType;
  encryptedCredentials: any; // Encrypted JSON
  healthStatus: ConnectorHealthStatus | null;
  healthStatusLastCheckedAt: Date | null;
  modifier: string | null;
}

export type ConnectorAccountWithCredentials = ConnectorAccount & DecryptedCredentials;
