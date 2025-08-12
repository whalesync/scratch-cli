import { FAKE_LEFT_COLUMNS, isActionsColumn, isIdColumn, isRecordStatusColumn } from '@/app/snapshots/[...slug]/components/snapshot-table/utils/helpers';
import { RecordCell } from '@/types/common';
import { SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { GridSelection } from '@glideapps/glide-data-grid';
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

export const findSelectedCellsAndRecordsWithSuggestions = (
  currentSelection: GridSelection | undefined,
  sortedRecords: SnapshotRecord[] | undefined,
): { cells: { wsId: string; columnId: string }[]; records: SnapshotRecord[]; allSuggestedCellsForSelectedRecords: { wsId: string; columnId: string }[] } => {
  // selected and have a suggestion
  const cellsWithSuggestions: { wsId: string; columnId: string }[] = [];
  // have at least 1 selected cell and at least 1 suggested cell
  const recordsWithSuggestions: SnapshotRecord[] = [];
  // all suggestions for selected records (selected or not)
  const allSuggestedCellsForSelectedRecords: { wsId: string; columnId: string }[] = [];

  if (!currentSelection || !currentSelection.current) return { cells: [], records: [], allSuggestedCellsForSelectedRecords: [] };

  const { range } = currentSelection.current;
  for (let r = range.y; r < range.y + range.height; r++) {
    const record = sortedRecords?.[r];
    if (record) {
      const suggestedValues = record.__suggested_values || {};
      let hasSelectedCell = false;
      let hasAnySuggestion = false;

      // Check if this record has any suggestions at all
      const columnsWithSuggestions = Object.keys(suggestedValues).filter(
        (columnId) => suggestedValues[columnId] !== null && suggestedValues[columnId] !== undefined,
      );
      hasAnySuggestion = columnsWithSuggestions.length > 0;

      // Check each column in the selected range for this record
      for (let c = range.x; c < range.x + range.width; c++) {
        const columnIndex = c - FAKE_LEFT_COLUMNS;
        if (columnIndex >= 0 && columnIndex < Object.keys(record.fields).length) {
          const columnId = Object.keys(record.fields)[columnIndex];
          if (columnId) {
            hasSelectedCell = true; // This record has at least one selected cell
            if (suggestedValues[columnId] !== null && suggestedValues[columnId] !== undefined) {
              cellsWithSuggestions.push({ wsId: record.id.wsId, columnId });
            }
          }
        }
      }

      // If this record has at least one selected cell AND at least one suggestion, add it to recordsWithSuggestions
      if (hasSelectedCell && hasAnySuggestion) {
        recordsWithSuggestions.push(record);
        // Add ALL suggestions for this record to allSuggestedCellsForSelectedRecords
        for (const columnId of columnsWithSuggestions) {
          allSuggestedCellsForSelectedRecords.push({ wsId: record.id.wsId, columnId });
        }
      }
    }
  }
  return { cells: cellsWithSuggestions, records: recordsWithSuggestions, allSuggestedCellsForSelectedRecords };
};