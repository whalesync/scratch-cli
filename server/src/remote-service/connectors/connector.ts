import { ConnectorAccount, Service } from '@prisma/client';
import { ConnectorRecord, TableListing, TablePath, TableSpec } from './types';

export abstract class Connector<T extends Service> {
  abstract readonly service: T;

  abstract testConnection(): Promise<void>;

  abstract listTables(account: ConnectorAccount): Promise<TableListing[]>;

  abstract fetchTableSpec(connectorPath: TablePath): Promise<TableSpec>;

  abstract downloadTableRecords(
    tableSpec: TableSpec,
    callback: (records: ConnectorRecord[]) => Promise<void>,
  ): Promise<void>;
}
