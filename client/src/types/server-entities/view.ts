export type ViewTableConfig = {
  visible?: boolean; // defaults to true
  editable?: boolean; // defaults to true
  records?: { wsId: string; visible?: boolean; editable?: boolean }[]; // wsIds of the records to include in the view
  columns?: { wsId: string; visible?: boolean; editable?: boolean }[]; // wsIds of the columns to include in the view
};

export type ViewConfig = {
  [tableId: string]: ViewTableConfig;
};

export interface View {
  id: string;
  parentId: string | null;
  name: string | null;
  snapshotId: string;
  config: ViewConfig;
  createdAt: string;
  updatedAt: string;
} 