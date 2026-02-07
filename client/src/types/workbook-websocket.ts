import { DataFolderId, WorkbookId } from '@spinner/shared-types';

export type MessageLogItem = {
  message: string;
  timestamp: Date;
};

export type Subscriptions = {
  workbook: boolean;
  tables: string[];
};

export interface WorkbookTableEvent {
  type: 'workbook-updated' | 'filter-changed' | 'page-size-changed' | 'sync-status-changed';
  data: {
    tableId?: DataFolderId;
    source: 'user' | 'agent';
    message?: string;
  };
}

export interface WorkbookTableRecordEvent {
  type: 'record-changes';
  data: {
    tableId: DataFolderId;
    numRecords: number;
    changeType: 'suggested' | 'accepted' | 'rejected';
    source: 'user' | 'agent';
    message?: string;
  };
}

export interface SubscriptionConfirmedEvent {
  workbookId: WorkbookId;
  tableId?: DataFolderId;
  message: string;
}
