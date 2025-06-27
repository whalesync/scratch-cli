import { ConnectorAccount, Service } from '@prisma/client';
import { ConnectorRecord, EntityId, TablePreview, TableSpec } from './types';

export abstract class Connector<T extends Service> {
  abstract readonly service: T;

  abstract testConnection(): Promise<void>;

  abstract listTables(account: ConnectorAccount): Promise<TablePreview[]>;

  abstract fetchTableSpec(id: EntityId): Promise<TableSpec>;

  abstract downloadTableRecords(
    tableSpec: TableSpec,
    callback: (records: ConnectorRecord[]) => Promise<void>,
  ): Promise<void>;

  abstract getBatchSize(operation: 'create' | 'update' | 'delete'): number;

  abstract createRecords(
    tableSpec: TableSpec,
    records: { wsId: string; fields: Record<string, unknown> }[],
  ): Promise<{ wsId: string; remoteId: string }[]>;

  // TODO: Should this return updated records?
  abstract updateRecords(
    tableSpec: TableSpec,
    records: { id: { wsId: string; remoteId: string }; partialFields: Record<string, unknown> }[],
  ): Promise<void>;

  abstract deleteRecords(tableSpec: TableSpec, recordIds: { wsId: string; remoteId: string }[]): Promise<void>;
}
