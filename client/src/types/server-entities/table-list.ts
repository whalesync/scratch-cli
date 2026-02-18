import { EntityId } from '@spinner/shared-types';

export interface TablePreview {
  id: EntityId;
  displayName: string;
}

export interface TableList {
  tables: TablePreview[];
}
