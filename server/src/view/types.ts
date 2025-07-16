export type ViewTableConfig = {
  visible?: boolean; // defaults to true
  editable?: boolean; // defaults to true
  records?: { wsId: string; visible?: boolean; editable?: boolean }[]; // wsIds of the records to include in the view
  columns?: { wsId: string; visible?: boolean; editable?: boolean }[]; // wsIds of the columns to include in the view
};

export type ViewConfig = {
  [tableId: string]: ViewTableConfig;
};
