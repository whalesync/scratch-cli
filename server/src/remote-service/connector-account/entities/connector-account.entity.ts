import { AuthType, ConnectorHealthStatus, ConnectorAccount as PrismaConnectorAccount, Service } from '@prisma/client';
import { JsonValue } from '@prisma/client/runtime/library';
import { DecryptedCredentials } from '../types/encrypted-credentials.interface';

export class ConnectorAccount implements PrismaConnectorAccount {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string | null;
  organizationId: string;
  service: Service;
  displayName: string;
  authType: AuthType;
  encryptedCredentials: any; // Encrypted JSON
  healthStatus: ConnectorHealthStatus | null;
  healthStatusLastCheckedAt: Date | null;
  healthStatusMessage: string | null;
  modifier: string | null;
  extras: JsonValue | null;
}

export type ConnectorAccountWithCredentials = ConnectorAccount & DecryptedCredentials;
