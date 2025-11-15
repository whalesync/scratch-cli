import { SnapshotRecord } from '@/types/server-entities/snapshot';
import { CellClassFunc, GridApi } from 'ag-grid-community';
import { ActiveCells } from '../../../../../stores/snapshot-editor-store';

export const getCellClassFn = (params: {
  gridApi: GridApi<SnapshotRecord> | null | undefined;
  activeCells: ActiveCells | null | undefined;
  columnId: string;
}) => {
  const { gridApi, activeCells, columnId } = params;
  const cellClass: CellClassFunc<SnapshotRecord, unknown> = (params) => {
    const classes: string[] = [];

    const focusedCell = gridApi?.getFocusedCell();
    const isInFocusedColumn = focusedCell && !activeCells?.recordId && focusedCell.column.getColId() === columnId;

    if (isInFocusedColumn) {
      classes.push('ag-cell-focus-column');
    }

    // Add 'cell-edited' class if this field has been edited
    if (params.data?.__edited_fields?.[columnId]) {
      classes.push('cell-edited');
    }

    return classes;
  };

  return cellClass;
};
