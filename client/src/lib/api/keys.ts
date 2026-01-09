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
  styleGuides: {
    list: () => ['style-guides', 'list'],
    detail: (id: StyleGuideId) => ['style-guides', 'detail', id],
  },
  billing: {
    plans: () => ['billing', 'plans'],
  },
  agentPricing: {
    list: () => ['agent-pricing', 'list'],
  },
  files: {
    list: (workbookId: WorkbookId) => ['files', 'list', workbookId] as const,
    listDetails: (workbookId: WorkbookId, folderId?: string | null) =>
      ['files', 'listDetails', workbookId, folderId ?? 'root'] as const,
    detail: (workbookId: WorkbookId, fileId: string) => ['files', 'detail', workbookId, fileId] as const,
    // Matches all file list keys for a workbook
    listKeyMatcher: (workbookId: WorkbookId) => (key: Arguments) =>
      Array.isArray(key) && key[0] === 'files' && key[1] === 'list' && key[2] === workbookId,
    // Matches all file keys for a workbook
    allKeyMatcher: (workbookId: WorkbookId) => (key: Arguments) =>
      Array.isArray(key) && key[0] === 'files' && key[2] === workbookId,
  },
};
