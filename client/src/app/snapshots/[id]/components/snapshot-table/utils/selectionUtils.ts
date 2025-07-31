import {RecordCell} from '@/app/snapshots/[id]/components/types';
import {FAKE_LEFT_COLUMNS, isActionsColumn, isIdColumn, isRecordStatusColumn} from '@/app/snapshots/[id]/components/snapshot-table/utils/helpers';
import { GridSelection } from '@glideapps/glide-data-grid';
import { SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
 // Helper function to check if selected cells match a focus condition
export const checkSelectedCellsFocus = (
    focusArray: RecordCell[], 
    shouldBeFocused: boolean,
    currentSelection: GridSelection | undefined,
    table: TableSpec,
    sortedRecords: SnapshotRecord[] | undefined
): boolean => {
      if (!currentSelection?.current) return false;

      const { range } = currentSelection.current;
      for (let r = range.y; r < range.y + range.height; r++) {
        for (let c = range.x; c < range.x + range.width; c++) {
          if (isActionsColumn(c, table.columns.length) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
          const rec = sortedRecords?.[r];
          const colObj = table.columns[c - FAKE_LEFT_COLUMNS];
          if (rec && colObj) {
            const cell: RecordCell = { recordWsId: rec.id.wsId, columnWsId: colObj.id.wsId };
            const isFocused = focusArray.some(
              (f) => f.recordWsId === cell.recordWsId && f.columnWsId === cell.columnWsId,
            );
            if (isFocused === shouldBeFocused) {
              return true;
            }
          }
        }
      }
      return false;
    };