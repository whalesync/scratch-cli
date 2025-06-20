export const SWR_KEYS = {
  connectorAccounts: {
    list: () => ["connector-accounts"],
    detail: (id: string) => ["connector-accounts", "detail", id],
  },
};
