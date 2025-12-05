import { SnapshotTableId, StyleGuideId, WorkbookId } from '@spinner/shared-types';
import { Arguments } from 'swr';

export const SWR_KEYS = {
  agentCredentials: {
    list: (includeUsageStats: boolean = false) => [
      'agent-credentials',
      includeUsageStats ? 'with-usage' : 'without-usage',
    ],
    detail: (id: string) => ['agent-credentials', 'detail', id],
  },
  connectorAccounts: {
    list: () => ['connector-accounts'],
    detail: (id: string) => ['connector-accounts', 'detail', id],
    allTables: () => ['connector-accounts', 'all-tables'],
  },
  workbook: {
    list: (sortBy?: string, sortOrder?: string) => ['workbook', 'list', sortBy ?? 'all', sortOrder ?? 'all'],
    listKeyMatcher: () => (key: Arguments) => Array.isArray(key) && key[0] === 'workbook' && key[1] === 'list',
    detail: (id: WorkbookId) => ['workbook', 'detail', id],
    records: (workbookId: WorkbookId, tableId: SnapshotTableId, skip?: number, take?: number) => [
      'workbook',
      'records',
      workbookId,
      tableId,
      skip,
      take,
    ],
    // Matches all SWR keys for records for a given workbook and table
    recordsKeyMatcher: (workbookId: WorkbookId, tableId: SnapshotTableId) => (key: Arguments) =>
      Array.isArray(key) &&
      key[0] === 'workbook' &&
      key[1] === 'records' &&
      key[2] === workbookId &&
      key[3] === tableId,
    publishSummary: (id: WorkbookId) => ['workbook', 'publish-summary', id],
  },
  operationCounts: { get: (id: WorkbookId) => ['operation-counts', id] },
  view: {
    list: (workbookId: WorkbookId) => ['view', 'list', workbookId],
    upsert: () => ['view', 'upsert'],
  },
  users: {
    activeUser: () => ['users', 'activeUser'],
  },
  agentUsage: {
    list: (cursor?: string, take?: number, credentialId?: string, month?: string) => [
      'agent-usage',
      'list',
      cursor,
      take,
      credentialId,
      month,
    ],
    summary: (credentialId?: string, month?: string) => ['agent-usage', 'summary', credentialId, month],
  },
  agentSessions: {
    list: (workbookId: WorkbookId) => ['agent-sessions', 'list', workbookId],
    detail: (id: string) => ['agent-sessions', 'detail', id],
  },
  uploads: {
    list: () => ['uploads', 'list'],
    detail: (id: string) => ['uploads', 'detail', id],
    csvData: (id: string, limit?: number, offset?: number) => ['uploads', 'csv-data', id, limit, offset],
    mdData: (id: string) => ['uploads', 'md-data', id],
  },

  styleGuides: {
    list: () => ['style-guides', 'list'],
    detail: (id: StyleGuideId) => ['style-guides', 'detail', id],
  },
  billing: {
    plans: () => ['billing', 'plans'],
  },
};
