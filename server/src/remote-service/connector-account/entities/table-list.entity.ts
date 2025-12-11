import { Service } from '@spinner/shared-types';
import { TablePreview } from '../../connectors/types';

export type TableList = {
  tables: TablePreview[];
};

export type TableGroup = {
  service: Service;
  connectorAccountId: string | null;
  displayName: string;
  tables: TablePreview[];
};
