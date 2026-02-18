import { EntityId, TableDiscoveryMode } from '@spinner/shared-types';

export interface TablePreview {
  id: EntityId;
  displayName: string;
}

export interface TableList {
  tables: TablePreview[];
  discoveryMode: TableDiscoveryMode;
}

export interface TableSearchResult {
  tables: TablePreview[];
  hasMore: boolean;
}
