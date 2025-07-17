export type ViewTableConfig = {
  hidden?: boolean; // defaults to false (visible)
  protected?: boolean; // defaults to false (editable)
  columns?: { wsId: string; hidden?: boolean; protected?: boolean }[]; // wsIds of the columns to include in the view
};

export type ViewConfig = {
  [tableId: string]: ViewTableConfig;
};
