import { TableDiscoveryMode } from '@spinner/shared-types';
import { TablePreview } from '../../connectors/types';

export type TableList = {
  tables: TablePreview[];
  discoveryMode: TableDiscoveryMode;
};

export type TableSearchResult = {
  tables: TablePreview[];
  hasMore: boolean;
};
