import { Service } from '@prisma/client';
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
