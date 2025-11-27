import { SnapshotRecord } from '@/types/server-entities/workbook';
import { CellClassFunc, GridApi } from 'ag-grid-community';
import { ActiveCells } from '../../../../../stores/workbook-editor-store';

/**
 * Put classes that are specific to the grid here. Other classes should probably be attached to
 * our wrappers so that we can use them outside of the grid too.
 */
export const getCellClassFn = (params: {
  gridApi: GridApi<SnapshotRecord> | null | undefined;
  activeCells: ActiveCells | null | undefined;
  columnId: string;
}) => {
  const { gridApi, activeCells, columnId } = params;
  const cellClass: CellClassFunc<SnapshotRecord, unknown> = () => {
    const classes: string[] = [];

    const focusedCell = gridApi?.getFocusedCell();
    const isInFocusedColumn = focusedCell && !activeCells?.recordId && focusedCell.column.getColId() === columnId;

    if (isInFocusedColumn) {
      classes.push('ag-cell-focus-column');
    }

    return classes;
  };

  return cellClass;
};
