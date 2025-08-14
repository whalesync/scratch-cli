export const SWR_KEYS = {
  agentCredentials: {
    list: () => ["agent-credentials"],
    detail: (id: string) => ["agent-credentials", "detail", id],
  },
  connectorAccounts: {
    list: () => ["connector-accounts"],
    detail: (id: string) => ["connector-accounts", "detail", id],
  },
  genericConnections: {
    list: () => ["generic-connections"],
  },
  customConnectors: {
    list: () => ["custom-connectors"],
    detail: (id: string) => ["custom-connectors", "detail", id],
  },
  customConnector: (id: string) => ["custom-connectors", id] as const,
  apiImport: {
    generatePollRecords: () => ["api-import", "generate-poll-records"],
    generateDeleteRecord: () => ["api-import", "generate-delete-record"],
    executeDeleteRecord: () => ["api-import", "execute-delete-record"],
  },
  snapshot: {
    list: (connectorAccountId: string) => [
      "snapshot",
      "list",
      connectorAccountId,
    ],
    detail: (id: string) => ["snapshot", "detail", id],
    records: (
      snapshotId: string,
      tableId: string,
      cursor?: string,
      take?: number,
      viewId?: string
    ) => ["snapshot", "records", snapshotId, tableId, cursor, take, viewId],
    views: (snapshotId: string, tableId: string) => ["snapshot", "views", snapshotId, tableId],
  },
  view: {
    list: (snapshotId: string) => ["view", "list", snapshotId],
    upsert: () => ["view", "upsert"],
  },
  users: {
    activeUser: () => ["users", "activeUser"],
  },
  agentUsage: {
    list: (cursor?: string, take?: number) => ["agent-usage", "list", cursor, take],
    summary: () => ["agent-usage", "summary"],
  },
};

export const API_IMPORT_KEYS = {
  generatePollRecords: (prompt: string) => ['api-import', 'generate-poll-records', prompt],
  executePollRecords: (functionString: string, apiKey: string) => ['api-import', 'execute-poll-records', functionString, apiKey],
  generateDeleteRecord: (prompt: string) => ['api-import', 'generate-delete-record', prompt],
  executeDeleteRecord: (functionString: string, recordId: string, apiKey: string) => ['api-import', 'execute-delete-record', functionString, recordId, apiKey],
  generateCreateRecord: (prompt: string) => ['api-import', 'generate-create-record', prompt],
  executeCreateRecord: (functionString: string, recordData: Record<string, unknown>, apiKey: string) => ['api-import', 'execute-create-record', functionString, recordData, apiKey],
  generateUpdateRecord: (prompt: string) => ['api-import', 'generate-update-record', prompt],
  executeUpdateRecord: (functionString: string, recordId: string, recordData: Record<string, unknown>, apiKey: string) => ['api-import', 'execute-update-record', functionString, recordId, recordData, apiKey],
} as const;
