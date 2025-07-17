export type ViewTableConfig = {
  hidden?: boolean; // defaults to false (visible)
  protected?: boolean; // defaults to false (editable)
  // records field moved to different entity - will be refactored soon
  columns?: { wsId: string; hidden?: boolean; protected?: boolean }[]; // wsIds of the columns to include in the view
};

export type ViewConfig = {
  [tableId: string]: ViewTableConfig;
};

export interface ColumnView {
  id: string;
  name: string | null;
  snapshotId: string;
  config: ViewConfig;
  createdAt: string;
  updatedAt: string;
} 