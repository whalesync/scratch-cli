import { DataFolderId, WorkbookId } from '@spinner/shared-types';

export type MessageLogItem = {
  message: string;
  timestamp: Date;
};

export type Subscriptions = {
  workbook: boolean;
  tables: string[];
};

export interface SubscriptionConfirmedEvent {
  workbookId: WorkbookId;
  tableId?: DataFolderId;
  message: string;
}
