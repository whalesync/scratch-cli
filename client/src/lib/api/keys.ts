import { DataFolderId, WorkbookId } from '@spinner/shared-types';
import { Arguments } from 'swr';

export const SWR_KEYS = {
  connectorAccounts: {
    list: (workbookId: string) => ['connector-accounts', 'list', workbookId],
    detail: (workbookId: string, id: string) => ['connector-accounts', 'detail', workbookId, id],
    allTables: (workbookId: string) => ['connector-accounts', 'all-tables', workbookId],
  },
  workbook: {
    list: (sortBy?: string, sortOrder?: string) => ['workbook', 'list', sortBy ?? 'all', sortOrder ?? 'all'],
    listKeyMatcher: () => (key: Arguments) => Array.isArray(key) && key[0] === 'workbook' && key[1] === 'list',
    detail: (id: WorkbookId) => ['workbook', 'detail', id],
    // Matches all SWR keys for records for a given workbook and table
    recordsKeyMatcher: (workbookId: WorkbookId, folderId: DataFolderId) => (key: Arguments) =>
      Array.isArray(key) &&
      key[0] === 'workbook' &&
      key[1] === 'records' &&
      key[2] === workbookId &&
      key[3] === folderId,
  },
  users: {
    activeUser: () => ['users', 'activeUser'],
  },
  billing: {
    plans: () => ['billing', 'plans'],
  },
  files: {
    listByFolder: (workbookId: WorkbookId, folderId: string) => ['files', 'list', workbookId, folderId] as const,
    detail: (workbookId: WorkbookId, fileId: string) => ['files', 'detail', workbookId, fileId] as const,
    // Matches all file list keys for a workbook
    listKeyMatcher: (workbookId: WorkbookId) => (key: Arguments) =>
      Array.isArray(key) && key[0] === 'files' && key[1] === 'list' && key[2] === workbookId,
    // Matches all file keys for a workbook
    allKeyMatcher: (workbookId: WorkbookId) => (key: Arguments) =>
      Array.isArray(key) && key[0] === 'files' && key[2] === workbookId,
  },
  jobs: {
    activeByWorkbook: (workbookId: WorkbookId) => ['jobs', 'active-by-workbook', workbookId] as const,
  },
  dataFolders: {
    list: (workbookId: WorkbookId) => ['data-folders', 'list', workbookId] as const,
    detail: (dataFolderId: DataFolderId) => ['data-folders', 'detail', dataFolderId] as const,
    files: (dataFolderId: DataFolderId, limit?: number, offset?: number) =>
      ['data-folders', 'files', dataFolderId, limit, offset] as const,
    publishStatus: (workbookId: WorkbookId) => ['data-folders', 'publish-status', workbookId] as const,
  },
};
