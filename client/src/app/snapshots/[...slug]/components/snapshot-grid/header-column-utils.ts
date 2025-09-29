/**
 * The server should return which the header column for the table is.
 * Until we do this we hack it on the client here.
 * Many services define this:
 * - For Notion this is the name column
 * - For youtube it is the video title
 * - For Airtable it is the 1st column (or we can make this configurable)
 * 
 * For other services the user has to pick the header column when the snapshot is being created. 
 * This is what happens in git sync.
 */

import { GridApi } from "ag-grid-community";
import {ColumnSpec, TableSpec} from '@/types/server-entities/snapshot';

export const getTitleColumn = (gridApi: GridApi) => {
  let titleColumn = gridApi.getColumns()?.find((col) => {
    const headerName = col.getColDef().headerName?.toLowerCase() ?? '';
    return commonTitleColumnPatterns.includes(headerName);
  }  );
  if (!titleColumn) {
    titleColumn = (gridApi.getColumns() ?? []).filter((col) => col.getColDef().headerName?.toLowerCase() !== 'id')[0];
  }
  return titleColumn;
};

export const getOtherColumns = (gridApi: GridApi) => {
  return (gridApi.getColumns() ?? []).filter((col) => col.getColDef().headerName?.toLowerCase() !== 'id');
};


const commonTitleColumnPatterns = [
  'title',
  'name'
];

export function identifyRecordTitleColumn(table: TableSpec): string {
  for (const column of table.columns) {
    if (commonTitleColumnPatterns.includes(column.name.toLowerCase()) || commonTitleColumnPatterns.includes(column.id.wsId.toLowerCase())) {
      return column.id.wsId;
    }
  }
  // If no title column is found, return the first column that isn't the ID column
  return table.columns.find((column) => column.id.wsId !== 'id')?.id.wsId ?? table.columns[0].id.wsId;
}


export function getHeaderColumnSpec(table: TableSpec): ColumnSpec | undefined {
  const headerColumnSpec = table.columns.find((col) => commonTitleColumnPatterns.includes(col.name.toLowerCase()));
  return headerColumnSpec;
}


export function getOtherColumnSpecs(table: TableSpec): ColumnSpec[]{
  const otherColumnSpecs = table.columns.filter((col) => !commonTitleColumnPatterns.includes(col.name.toLowerCase()));
  return otherColumnSpecs;
}