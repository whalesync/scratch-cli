import { Service } from './connector-accounts';

export interface EntityId {
  wsId: string;
  remoteId: string[];
}

export interface TablePreview {
  id: EntityId;
  displayName: string;
}

export interface TableList {
  tables: TablePreview[];
}

export interface TableGroup {
  service: Service;
  connectorAccountId: string | null;
  displayName: string;
  tables: TablePreview[];
}
