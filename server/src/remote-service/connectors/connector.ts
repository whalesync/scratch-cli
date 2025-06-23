import { ConnectorAccount, Service } from '@prisma/client';
import { TableList } from '../connector-account/entities/table-list.entity';

export abstract class Connector<S extends Service> {
  readonly service: S;

  abstract testConnection(): Promise<void>;

  abstract listTables(account: ConnectorAccount): Promise<TableList>;
}
