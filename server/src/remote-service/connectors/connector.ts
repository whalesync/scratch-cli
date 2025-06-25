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
}
