import { FAKE_LEFT_COLUMNS } from '@/app/snapshots/[...slug]/components/snapshot-table/utils/helpers';
import { ColumnSpec, SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { GridSelection } from '@glideapps/glide-data-grid';
import { useCallback, useMemo } from 'react';
export const useProcessedSelection = (
    currentSelection: GridSelection | undefined,
    sortedRecords: SnapshotRecord[] | undefined,
    table: TableSpec,
) => {
    const getGetSelectedRecordsAndColumns = useCallback(() => {
        const result: {
          records: SnapshotRecord[];
          columns: ColumnSpec[];
        } = {
          records: [],
          columns: [],
        };
    
        if (currentSelection && currentSelection.current) {
          const range = currentSelection.current.range;
          const startRow = range.y;
          const endRow = range.y + range.height; // not inclusive endpoint
    
          for (let row = startRow; row < endRow; row++) {
            const record = sortedRecords?.[row];
            if (record) {
              result.records.push(record);
            }
          }
          const startCol = range.x - FAKE_LEFT_COLUMNS;
          const endCol = range.x + range.width - FAKE_LEFT_COLUMNS;
    
          result.columns = table.columns.filter((c, idx) => {
            return idx >= startCol && idx < endCol;
          });
        }
    
        if (currentSelection && currentSelection.rows) {
          for (const row of currentSelection.rows) {
            const record = sortedRecords?.[row];
            if (record) {
              result.records.push(record);
            }
          }
        }
    
        return result;
      }, [currentSelection, table.columns, sortedRecords]);

    const selectedRecordsAndColumns = useMemo(() => {
      return getGetSelectedRecordsAndColumns();
    }, [getGetSelectedRecordsAndColumns]);

    const isSingleCellSelected =
      currentSelection?.current &&
      currentSelection.current.range.width === 1 &&
      currentSelection.current.range.height === 1;

    // Get the single selected cell for cell-specific actions
    const singleCellRange = currentSelection?.current?.range;
    const singleCellColIndex = singleCellRange?.x ?? 0;
    // const singleCellRow = singleCellRange?.y;
    // const singleCellRecord = sortedRecords?.[singleCellRow??0];
    const singleCellColumn = isSingleCellSelected ? table.columns[singleCellColIndex - FAKE_LEFT_COLUMNS] : undefined;

  return { selectedRecordsAndColumns, isSingleCellSelected, singleCellColumn, singleCellColIndex};
};