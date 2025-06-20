export const SWR_KEYS = {
  connections: {
    list: () => ["connections"],
    detail: (id: string) => ["connections", "detail", id],
  },
};
