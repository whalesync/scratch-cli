import { ColumnSpec } from '@spinner/shared-types';
export const isActionsColumn = (col: number, colLength: number) => {
  return col === colLength + 2;
};

export const isIdColumn = (col: number) => {
  return col === 1; // Updated to account for the new record status column
};

export const isRecordStatusColumn = (col: number) => {
  return col === 0; // New column for record status icons
};

export const isSpecialColumn = (col: number, colLength: number) => {
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

export const FAKE_LEFT_COLUMNS = 2; // Updated to account for the new record status column
