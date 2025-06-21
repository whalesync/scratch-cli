export const SWR_KEYS = {
  connectorAccounts: {
    list: () => ["connector-accounts"],
    detail: (id: string) => ["connector-accounts", "detail", id],
  },
  users: {
    activeUser: () => ["users", "activeUser"],
  },
  editSessions: {
    list: (connectorAccountId: string) => [
      "edit-sessions",
      "list",
      connectorAccountId,
    ],
    detail: (id: string) => ["edit-sessions", "detail", id],
  },
};
