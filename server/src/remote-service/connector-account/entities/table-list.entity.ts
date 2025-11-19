import { Service } from '@prisma/client';
import { TablePreview } from '../../connectors/types';

export class TableList {
  tables: TablePreview[];
}

export class TableGroup {
  service: Service;
  connectorAccountId: string | null;
  displayName: string;
  tables: TablePreview[];
}
