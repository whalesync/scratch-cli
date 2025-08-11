import {
  ACCEPT_REJECT_GROUP_NAME,
  FILTERING_GROUP_NAME,
  FOCUS_GROUP_NAME,
  MENU_ICON_SIZE,
} from '@/app/snapshots/[...slug]/components/snapshot-table/menus/constants';
import {
  FAKE_LEFT_COLUMNS,
  getSelectedRowCount,
  isActionsColumn,
  isIdColumn,
  isRecordStatusColumn,
} from '@/app/snapshots/[...slug]/components/snapshot-table/utils/helpers';
import { ContextMenu, MenuItem } from '@/app/snapshots/[...slug]/components/types';
import { useFocusedCellsContext } from '@/app/snapshots/[...slug]/FocusedCellsContext';
import { ICONS } from '@/app/snapshots/[...slug]/icons';
import { snapshotApi } from '@/lib/api/snapshot';
import { RecordCell } from '@/types/common';
import { Snapshot, SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { GridSelection } from '@glideapps/glide-data-grid';
import { CheckIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Eye, EyeSlash, ListBulletsIcon, ListChecksIcon, Pencil, PencilSlash, XIcon } from '@phosphor-icons/react';
import { useCallback } from 'react';
import { checkSelectedCellsFocus, findSelectedCellsAndRecordsWithSuggestions } from './utils/selectionUtils';
export const useContextMenuItems = (
  contextMenu: ContextMenu | null,
  setContextMenu: (contextMenu: ContextMenu | null) => void,
  currentSelection: GridSelection | undefined,
  table: TableSpec,
  sortedRecords: SnapshotRecord[] | undefined,
  snapshot: Snapshot,
  handleAcceptRecords: () => Promise<unknown>,
  handleRejectRecords: () => Promise<unknown>,
  handleAcceptCell: () => Promise<unknown>,
  handleRejectCell: () => Promise<unknown>,
  refreshRecords: () => void,
) => {
  const { readFocus, writeFocus, addReadFocus, addWriteFocus, removeReadFocus, removeWriteFocus } =
    useFocusedCellsContext();

  const getContextMenuItems = useCallback(() => {
    if (!contextMenu) return [];

    const hasUnfocusedReadCells = checkSelectedCellsFocus(readFocus, false, currentSelection, table, sortedRecords);
    const hasFocusedReadCells = checkSelectedCellsFocus(readFocus, true, currentSelection, table, sortedRecords);
    const hasUnfocusedWriteCells = checkSelectedCellsFocus(writeFocus, false, currentSelection, table, sortedRecords);
    const hasFocusedWriteCells = checkSelectedCellsFocus(writeFocus, true, currentSelection, table, sortedRecords);

    // Conditionally show add/remove items
    const focusItems: MenuItem[] = [];
    if (hasUnfocusedReadCells) {
      focusItems.push({
        label: 'Add Read Focus',
        disabled: false,
        leftSection: <Eye size={MENU_ICON_SIZE} color="#0066cc" />,
        group: FOCUS_GROUP_NAME,
        handler: async () => {
          // Add all selected cells to readFocus (avoid duplicates)
          if (!currentSelection) return;
          const newCells: RecordCell[] = [];
          if (currentSelection.current) {
            const { range } = currentSelection.current;
            for (let r = range.y; r < range.y + range.height; r++) {
              for (let c = range.x; c < range.x + range.width; c++) {
                if (isActionsColumn(c, table.columns.length) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
                const rec = sortedRecords?.[r];
                const colObj = table.columns[c - FAKE_LEFT_COLUMNS];
                if (rec && colObj) {
                  const cell: RecordCell = { recordWsId: rec.id.wsId, columnWsId: colObj.id.wsId };
                  // Avoid duplicates
                  if (!readFocus.some((f) => f.recordWsId === cell.recordWsId && f.columnWsId === cell.columnWsId)) {
                    newCells.push(cell);
                  }
                }
              }
            }
          }
          addReadFocus(newCells);
          notifications.show({
            title: 'Read Focus Added',
            message: `Added ${newCells.length} cell(s) to read focus`,
            color: 'blue',
          });
          setContextMenu(null);
          return;
        },
      });
    }
    if (hasFocusedReadCells) {
      focusItems.push({
        label: 'Remove Read Focus',
        disabled: false,
        leftSection: <EyeSlash size={MENU_ICON_SIZE} />,
        group: FOCUS_GROUP_NAME,
        handler: async () => {
          // Remove selected cells from readFocus
          if (!currentSelection) return;
          const cellsToRemove: RecordCell[] = [];
          if (currentSelection.current) {
            const { range } = currentSelection.current;
            for (let r = range.y; r < range.y + range.height; r++) {
              for (let c = range.x; c < range.x + range.width; c++) {
                if (isActionsColumn(c, table.columns.length) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
                const rec = sortedRecords?.[r];
                const colObj = table.columns[c - FAKE_LEFT_COLUMNS];
                if (rec && colObj) {
                  const cell: RecordCell = { recordWsId: rec.id.wsId, columnWsId: colObj.id.wsId };
                  if (readFocus.some((f) => f.recordWsId === cell.recordWsId && f.columnWsId === cell.columnWsId)) {
                    cellsToRemove.push(cell);
                  }
                }
              }
            }
          }
          removeReadFocus(cellsToRemove);
          notifications.show({
            title: 'Read Focus Removed',
            message: `Removed ${cellsToRemove.length} cell(s) from read focus`,
            color: 'blue',
          });
          setContextMenu(null);
          return;
        },
      });
    }
    if (hasUnfocusedWriteCells) {
      focusItems.push({
        label: 'Add Write Focus',
        disabled: false,
        leftSection: <Pencil size={MENU_ICON_SIZE} color="#ff8c00" />,
        group: FOCUS_GROUP_NAME,
        handler: async () => {
          // Add all selected cells to writeFocus (avoid duplicates)
          if (!currentSelection) return;
          const newCells: RecordCell[] = [];
          if (currentSelection.current) {
            const { range } = currentSelection.current;
            for (let r = range.y; r < range.y + range.height; r++) {
              for (let c = range.x; c < range.x + range.width; c++) {
                if (isActionsColumn(c, table.columns.length) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
                const rec = sortedRecords?.[r];
                const colObj = table.columns[c - FAKE_LEFT_COLUMNS];
                if (rec && colObj) {
                  const cell: RecordCell = { recordWsId: rec.id.wsId, columnWsId: colObj.id.wsId };
                  // Avoid duplicates
                  if (!writeFocus.some((f) => f.recordWsId === cell.recordWsId && f.columnWsId === cell.columnWsId)) {
                    newCells.push(cell);
                  }
                }
              }
            }
          }
          addWriteFocus(newCells);
          notifications.show({
            title: 'Write Focus Added',
            message: `Added ${newCells.length} cell(s) to write focus`,
            color: 'orange',
          });
          setContextMenu(null);
          return;
        },
      });
    }
    if (hasFocusedWriteCells) {
      focusItems.push({
        label: 'Remove Write Focus',
        disabled: false,
        leftSection: <PencilSlash size={MENU_ICON_SIZE} />,
        group: FOCUS_GROUP_NAME,
        handler: async () => {
          // Remove selected cells from writeFocus
          if (!currentSelection) return;
          const cellsToRemove: RecordCell[] = [];
          if (currentSelection.current) {
            const { range } = currentSelection.current;
            for (let r = range.y; r < range.y + range.height; r++) {
              for (let c = range.x; c < range.x + range.width; c++) {
                if (isActionsColumn(c, table.columns.length) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
                const rec = sortedRecords?.[r];
                const colObj = table.columns[c - FAKE_LEFT_COLUMNS];
                if (rec && colObj) {
                  const cell: RecordCell = { recordWsId: rec.id.wsId, columnWsId: colObj.id.wsId };
                  if (writeFocus.some((f) => f.recordWsId === cell.recordWsId && f.columnWsId === cell.columnWsId)) {
                    cellsToRemove.push(cell);
                  }
                }
              }
            }
          }
          removeWriteFocus(cellsToRemove);
          notifications.show({
            title: 'Write Focus Removed',
            message: `Removed ${cellsToRemove.length} cell(s) from write focus`,
            color: 'orange',
          });
          setContextMenu(null);
        },
      });
    }

    const items = focusItems;

    // Add Filter Out Records item if records are selected
    if (currentSelection && getSelectedRowCount(currentSelection) > 0) {
      items.push({
        label: 'Filter Out Records',
        disabled: false,
        group: FILTERING_GROUP_NAME,
        leftSection: ICONS.hidden,
        handler: async () => {
          if (!currentSelection) return;

          // Get all selected record IDs
          const selectedRecordIds: string[] = [];

          if (currentSelection.current) {
            const { range } = currentSelection.current;
            for (let r = range.y; r < range.y + range.height; r++) {
              const record = sortedRecords?.[r];
              if (record) {
                selectedRecordIds.push(record.id.wsId);
              }
            }
          }

          if (currentSelection.rows) {
            for (const row of currentSelection.rows) {
              const record = sortedRecords?.[row];
              if (record) {
                selectedRecordIds.push(record.id.wsId);
              }
            }
          }

          if (selectedRecordIds.length === 0) {
            notifications.show({
              title: 'No Records Selected',
              message: 'Please select one or more records to filter out',
              color: 'yellow',
            });
            setContextMenu(null);
            return;
          }

          try {
            // Create SQL WHERE clause to exclude selected records
            const recordIdsList = selectedRecordIds.map((id) => `'${id}'`).join(', ');
            const sqlWhereClause = `"wsId" NOT IN (${recordIdsList})`;

            await snapshotApi.setActiveRecordsFilter(snapshot.id, table.id.wsId, sqlWhereClause);
            notifications.show({
              title: 'Filter Updated',
              message: `Filtered out ${selectedRecordIds.length} record(s)`,
              color: 'green',
            });
            // Refresh the records to update the filtered count
            await refreshRecords();
          } catch (e) {
            const error = e as Error;
            notifications.show({
              title: 'Error updating filter',
              message: error.message,
              color: 'red',
            });
          }
          setContextMenu(null);
        },
      });
    }

    // Check if any selected records have suggestions (for Accept/Reject Record actions)
    const { records: selectedRecordsWithSuggestions, allSuggestedCellsForSelectedRecords } =
      findSelectedCellsAndRecordsWithSuggestions(currentSelection, sortedRecords);

    // Add Accept/Reject Record actions if any selected records have suggestions
    if (selectedRecordsWithSuggestions.length > 0) {
      const totalSuggestions = allSuggestedCellsForSelectedRecords.length;

      const suggestionText = totalSuggestions === 1 ? 'suggestion' : 'suggestions';
      const recordText = selectedRecordsWithSuggestions.length === 1 ? 'record' : 'records';

      items.push({
        label: `Accept ${recordText} (${totalSuggestions} ${suggestionText})`,
        disabled: false,
        group: ACCEPT_REJECT_GROUP_NAME,
        leftSection: <ListChecksIcon size={MENU_ICON_SIZE} color="#00aa00" />,
        handler: handleAcceptRecords,
      });
      items.push({
        label: `Reject ${recordText} (${totalSuggestions} ${suggestionText})`,
        disabled: false,
        group: ACCEPT_REJECT_GROUP_NAME,
        leftSection: <ListBulletsIcon size={MENU_ICON_SIZE} color="#ff0000" />,
        handler: handleRejectRecords,
      });
    }

    // Check if any selected cells have suggestions (for Accept/Reject Selected Suggestions actions)
    const { cells: selectedCellsWithSuggestions } = findSelectedCellsAndRecordsWithSuggestions(
      currentSelection,
      sortedRecords,
    );
    const hasSelectedCellsWithSuggestions = selectedCellsWithSuggestions.length > 0;

    if (hasSelectedCellsWithSuggestions) {
      // Count total suggestions for better UX
      const totalSuggestions = selectedCellsWithSuggestions.length;

      const suggestionText = totalSuggestions === 1 ? 'cell' : 'cells';

      items.push({
        label: `Accept Selected Suggestions (${totalSuggestions} ${suggestionText})`,
        disabled: false,
        group: ACCEPT_REJECT_GROUP_NAME,
        leftSection: <CheckIcon size={MENU_ICON_SIZE} color="#00aa00" />,
        handler: handleAcceptCell,
      });
      items.push({
        label: `Reject Selected Suggestions (${totalSuggestions} ${suggestionText})`,
        disabled: false,
        group: ACCEPT_REJECT_GROUP_NAME,
        leftSection: <XIcon size={MENU_ICON_SIZE} color="#ff0000" />,
        handler: handleRejectCell,
      });
    }

    if (items.length === 0) {
      items.push({ label: 'No actions', disabled: true });
    }

    return items;
  }, [
    contextMenu,
    readFocus,
    currentSelection,
    table,
    sortedRecords,
    writeFocus,
    addReadFocus,
    setContextMenu,
    removeReadFocus,
    addWriteFocus,
    removeWriteFocus,
    snapshot.id,
    refreshRecords,
    handleAcceptRecords,
    handleRejectRecords,
    handleAcceptCell,
    handleRejectCell,
  ]);

  return {
    getContextMenuItems,
  };
};
