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


export const isColumnHidden = (tableId: string, columnId: string, view: ColumnView) => {
  if(view){
    const tableConfig = view.config[tableId];
    const columnConfig = tableConfig?.columns?.find((col: { wsId: string }) => col.wsId === columnId);
    return columnConfig?.hidden;
  }
  return false;
}

 export const isColumnProtected = (tableId: string, columnId: string, view: ColumnView) => {
  if(view){
    const tableConfig = view.config[tableId];
    const columnConfig = tableConfig?.columns?.find((col: { wsId: string }) => col.wsId === columnId);
    return columnConfig?.protected;
  }
  return false;
}
