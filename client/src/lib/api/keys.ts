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
      take?: number
    ) => ["snapshot", "records", snapshotId, tableId, cursor, take],
  },
  users: {
    activeUser: () => ["users", "activeUser"],
  },
};
