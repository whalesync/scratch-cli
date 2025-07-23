import { ConnectorAccount, Service } from '@prisma/client';
import { TableSpecs } from './library/custom-spec-registry';
import { ConnectorRecord, EntityId, TablePreview } from './types';

export abstract class Connector<T extends Service> {
  abstract readonly service: T;

  abstract testConnection(): Promise<void>;

  abstract listTables(account: ConnectorAccount): Promise<TablePreview[]>;

  abstract fetchTableSpec(id: EntityId, account: ConnectorAccount): Promise<TableSpecs[T]>;

  abstract downloadTableRecords(
    tableSpec: TableSpecs[T],
    callback: (records: ConnectorRecord[]) => Promise<void>,
    account: ConnectorAccount,
  ): Promise<void>;

  abstract getBatchSize(operation: 'create' | 'update' | 'delete'): number;

  abstract createRecords(
    tableSpec: TableSpecs[T],
    records: { wsId: string; fields: Record<string, unknown> }[],
    account: ConnectorAccount,
  ): Promise<{ wsId: string; remoteId: string }[]>;

  // TODO: Should this return updated records?
  abstract updateRecords(
    tableSpec: TableSpecs[T],
    records: { id: { wsId: string; remoteId: string }; partialFields: Record<string, unknown> }[],
    account: ConnectorAccount,
  ): Promise<void>;

  abstract deleteRecords(
    tableSpec: TableSpecs[T],
    recordIds: { wsId: string; remoteId: string }[],
    account: ConnectorAccount,
  ): Promise<void>;
}
