export const SWR_KEYS = {
  connectorAccounts: {
    list: () => ["connector-accounts"],
    detail: (id: string) => ["connector-accounts", "detail", id],
  },
  genericConnections: {
    list: () => ["generic-connections"],
  },
  genericTables: {
    list: () => ["generic-tables"],
    detail: (id: string) => ["generic-tables", "detail", id],
  },
  genericTable: (id: string) => ["generic-tables", id] as const,
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
  users: {
    activeUser: () => ["users", "activeUser"],
  },
};
