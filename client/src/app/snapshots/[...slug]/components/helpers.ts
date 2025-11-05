import {ColumnSpec} from '@/types/server-entities/snapshot';
import {GridSelection, GridColumnIcon} from '@glideapps/glide-data-grid';
export const isActionsColumn = (col: number, colLength: number) => {
    return col === colLength + 2;
  };

export const isIdColumn = (col: number) => {
    return col === 1; // Updated to account for the new record status column
}

export const isRecordStatusColumn = (col: number) => {
    return col === 0; // New column for record status icons
}

export const isSpecialColumn =  (col: number, colLength: number) => {
    return col < 0 || isRecordStatusColumn(col) || isActionsColumn(col, colLength);
};


export type SortDirection = 'asc' | 'desc';

export interface SortState {
  columnId: string;
  dir: SortDirection;
}
export function titleWithSort(column: ColumnSpec, sort: SortState | undefined) {
    if (sort?.columnId !== column.id.wsId) {
      return column.name;
    }
    const icon = sort.dir === 'asc' ? '🔼' : '🔽';
    return `${column.name} ${icon}`;
  }
  
export function getSelectedRowCount(currentSelection: GridSelection | undefined) {
    if (!currentSelection) return 0;
  
    if (currentSelection.current) {
      return currentSelection.current.range.height;
    }
  
    if (currentSelection.rows) {
      return currentSelection.rows.length;
    }
  
    return 0;
  }

  export const getColumnIcon = (column: ColumnSpec): GridColumnIcon => {
    switch (column.pgType) {
      case 'text':
        return GridColumnIcon.HeaderString;
      case 'text[]':
        return GridColumnIcon.HeaderArray;
      case 'numeric':
        return GridColumnIcon.HeaderNumber;
      case 'numeric[]':
        return GridColumnIcon.HeaderArray;
      case 'boolean':
        return GridColumnIcon.HeaderBoolean;
      case 'boolean[]':
        return GridColumnIcon.HeaderArray;
      case 'jsonb':
        return GridColumnIcon.HeaderCode;
      default:
        return GridColumnIcon.HeaderString;
    }
  };

  export const FAKE_LEFT_COLUMNS = 2; // Updated to account for the new record status column

  export const generatePendingId = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'ws_pending_';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };