import { ConnectorAccount as PrismaConnectorAccount } from '@prisma/client';
import { DecryptedCredentials } from '../types/encrypted-credentials.interface';

export type ConnectorAccount = Pick<
  PrismaConnectorAccount,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'userId'
  | 'organizationId'
  | 'service'
  | 'displayName'
  | 'authType'
  | 'encryptedCredentials'
  | 'healthStatus'
  | 'healthStatusLastCheckedAt'
  | 'healthStatusMessage'
  | 'modifier'
  | 'extras'
>;

export type ConnectorAccountWithCredentials = ConnectorAccount & DecryptedCredentials;
