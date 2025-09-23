import { GridApi } from "ag-grid-community";

export const getTitleColumn = (gridApi: GridApi) => {
  let titleColumn = gridApi.getColumns()?.find((col) => col.getColDef().headerName?.toLowerCase() === 'title');
  if (!titleColumn) {
    titleColumn = (gridApi.getColumns() ?? []).filter((col) => col.getColDef().headerName?.toLowerCase() !== 'id')[0];
  }
  return titleColumn;
};

export const getOtherColumns = (gridApi: GridApi) => {
  return (gridApi.getColumns() ?? []).filter((col) => col.getColDef().headerName?.toLowerCase() !== 'id');
};