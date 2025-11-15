/**
 * The server can optionally specify which column is the header/title column via titleColumnRemoteId.
 * When set, this is used as the primary identifier for records in the UI.
 * 
 * Many services define this:
 * - For CSV this picked by the user when the snapshot is being created
 * - For Notion this is the name column
 * - For youtube it is the video title
 * - For Airtable it is the 1st column (or we can make this configurable)
 * 
 * When titleColumnRemoteId is not set, we fall back to pattern matching (looking for 'title' or 'name' columns).
 * For other services, the user may pick the header column when the snapshot is being created (e.g., git sync).
 */

import { ColumnSpec, TableSpec } from '@/types/server-entities/snapshot';
import { GridApi } from "ag-grid-community";

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
  // If titleColumnRemoteId is explicitly set in the spec, use it
  if (table.titleColumnRemoteId) {
    // Find the column with matching remoteId
    const titleColumn = table.columns.find((col) => 
      col.id.remoteId.length === table.titleColumnRemoteId!.length &&
      col.id.remoteId.every((val, idx) => val === table.titleColumnRemoteId![idx])
    );
    if (titleColumn) {
      return titleColumn.id.wsId;
    }
  }
  
  // Fall back to checking for common title column patterns
  for (const column of table.columns) {
    if (commonTitleColumnPatterns.includes(column.name.toLowerCase()) || commonTitleColumnPatterns.includes(column.id.wsId.toLowerCase())) {
      return column.id.wsId;
    }
  }
  // If no title column is found, return the first column that isn't the ID column
  return table.columns.find((column) => column.id.wsId !== 'id')?.id.wsId ?? table.columns[0].id.wsId;
}


export function getHeaderColumnSpec(table: TableSpec): ColumnSpec | undefined {
  // If titleColumnRemoteId is explicitly set in the spec, use it
  if (table.titleColumnRemoteId) {
    const headerColumnSpec = table.columns.find((col) => 
      col.id.remoteId.length === table.titleColumnRemoteId!.length &&
      col.id.remoteId.every((val, idx) => val === table.titleColumnRemoteId![idx])
    );
    if (headerColumnSpec) {
      return headerColumnSpec;
    }
  }
  
  // Fall back to checking for common title column patterns
  const headerColumnSpec = table.columns.find((col) => commonTitleColumnPatterns.includes(col.name.toLowerCase()));
  return headerColumnSpec;
}


export function getOtherColumnSpecs(table: TableSpec): ColumnSpec[]{
  // First check if titleColumnRemoteId is explicitly set
  if (table.titleColumnRemoteId) {
    const otherColumnSpecs = table.columns.filter((col) => 
      !(col.id.remoteId.length === table.titleColumnRemoteId!.length &&
        col.id.remoteId.every((val, idx) => val === table.titleColumnRemoteId![idx]))
    );
    return otherColumnSpecs;
  }
  
  // Fall back to checking for common title column patterns
  const otherColumnSpecs = table.columns.filter((col) => !commonTitleColumnPatterns.includes(col.name.toLowerCase()));
  return otherColumnSpecs;
}

export function getGridOrderedColumnSpecs(table: TableSpec): ColumnSpec[] {
  const headerColumnSpecs = getHeaderColumnSpec(table);
  const otherColumnSpecs = getOtherColumnSpecs(table);
  return headerColumnSpecs ? [headerColumnSpecs, ...otherColumnSpecs] : otherColumnSpecs;
}

export function getDotColumn(gridApi: GridApi) {
  return gridApi.getColumns()?.find((col) => {
    // dot column has no header name and field is empty
    return (
      (col.getColDef().headerName === undefined || col.getColDef().headerName === '') &&
      (col.getColDef().field === undefined || col.getColDef().field === '')
    );
  });
}