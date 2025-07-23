'use client';

import { useSnapshotContext } from '@/app/snapshots/[id]/SnapshotContext';
import { snapshotApi } from '@/lib/api/snapshot';
import { BulkUpdateRecordsDto } from '@/types/server-entities/records';
import { ColumnSpec, Snapshot, SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import {
  CellClickedEventArgs,
  EditableGridCell,
  GridCell,
  GridCellKind,
  GridColumn,
  GridColumnIcon,
  GridColumnMenuIcon,
  GridKeyEventArgs,
  GridSelection,
  Item,
  Theme,
} from '@glideapps/glide-data-grid';
import { useModalsStack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  CheckIcon,
  Eye,
  EyeSlash,
  ListBulletsIcon,
  ListChecksIcon,
  Pencil,
  PencilSlash,
  XIcon,
} from '@phosphor-icons/react';
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { useSnapshotRecords } from '../../../../../hooks/use-snapshot';
import { useUpsertView } from '../../../../../hooks/use-view';
import { useFocusedCellsContext } from '../../FocusedCellsContext';
import { ICONS } from '../../icons';
import { FocusedCell, MenuItem } from '../types';
import {
  ACCEPT_REJECT_GROUP_NAME,
  COLUMN_VIEW_GROUP_NAME,
  FILTERING_GROUP_NAME,
  FOCUS_GROUP_NAME,
  MENU_ICON_SIZE,
} from './contextMenu.ts/constants';
import {
  FAKE_LEFT_COLUMNS,
  generatePendingId,
  getColumnIcon,
  getSelectedRowCount,
  isActionsColumn,
  isIdColumn,
  isRecordStatusColumn,
  isSpecialColumn,
  SortState,
  titleWithSort,
} from './helpers';
import { useMousePosition } from './useMousePosition';

const SnapshotTableGridContext = createContext<SnapshotTableGridContextValue | undefined>(undefined);

interface SnapshotTableGridProps {
  snapshot: Snapshot;
  table: TableSpec;
  currentViewId?: string | null;
  onSwitchToRecordView: (recordId: string, columnId?: string) => void;
  filterToView: boolean;
}

type ContextMenu = {
  visible: boolean;
  x: number;
  y: number;
};

export const SnapshotTableGridProvider = ({
  children,
  snapshot,
  table,
  currentViewId,
  onSwitchToRecordView,
  filterToView,
}: SnapshotTableGridProps & { children: ReactNode }) => {
  const mousePosition = useMousePosition();
  const [hoveredRow, setHoveredRow] = useState<number | undefined>();
  const modalStack = useModalsStack(['focusedCellsDebug']);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [sort, setSort] = useState<SortState | undefined>();
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [headerMenu, setHeaderMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    col: number;
  } | null>(null);
  const [currentSelection, setCurrentSelection] = useState<GridSelection | undefined>();

  const { refreshViews, setCurrentViewId, currentView } = useSnapshotContext();
  const { readFocus, writeFocus, addReadFocus, addWriteFocus, removeReadFocus, removeWriteFocus, clearAllFocus } =
    useFocusedCellsContext();

  const activeView = currentView;

  const { records, isLoading, error, bulkUpdateRecords, acceptCellValues, rejectCellValues, refreshRecords } =
    useSnapshotRecords({
      snapshotId: snapshot.id,
      tableId: table.id.wsId,
      viewId: filterToView && activeView ? activeView.id : undefined,
    });

  const { upsertView } = useUpsertView();

  const sortedRecords = useMemo(() => {
    if (!records) return undefined;

    if (!sort) {
      return records;
    }

    const { columnId, dir } = sort;

    const sortedOthers = records.sort((a, b) => {
      const aVal = a.fields[columnId];
      const bVal = b.fields[columnId];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return -1;
      if (bVal === null || bVal === undefined) return 1;

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();

      if (strA < strB) {
        return dir === 'asc' ? -1 : 1;
      }
      if (strA > strB) {
        return dir === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sortedOthers;
  }, [records, sort]);

  const onCellClicked = useCallback(
    (cell: Item, event: CellClickedEventArgs) => {
      const [col, row] = cell;
      if (isActionsColumn(col, table.columns.length)) {
        // Actions column
        const record = sortedRecords?.[row];
        if (!record) return;

        try {
          if (record.__edited_fields?.__deleted) {
            bulkUpdateRecords({
              ops: [{ op: 'undelete', wsId: record.id.wsId }],
            });
          } else {
            bulkUpdateRecords({
              ops: [{ op: 'delete', wsId: record.id.wsId }],
            });
          }
        } catch (e) {
          const error = e as Error;
          notifications.show({
            title: 'Error deleting record',
            message: error.message,
            color: 'red',
          });
        }
      }

      if (event.isDoubleClick && !isSpecialColumn(col, table.columns.length)) {
        event.preventDefault();
        const record = sortedRecords?.[row];
        if (!record) return;
        const column = table.columns[col - FAKE_LEFT_COLUMNS];
        onSwitchToRecordView(record.id.wsId, column?.id.wsId);
      }
    },
    [bulkUpdateRecords, onSwitchToRecordView, sortedRecords, table.columns],
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const record = sortedRecords?.[row];
      const editedFields = record?.__edited_fields;
      const suggestedValues = record?.__suggested_values;
      const isHovered = hoveredRow === row;
      const isDeleted = !!editedFields?.__deleted;
      const isSuggestedDeleted = !!suggestedValues?.__deleted;
      // const isFiltered = record?.filtered;

      // Check if this cell is focused
      const isFocused =
        record &&
        readFocus.some(
          (focusedCell) =>
            focusedCell.recordWsId === record.id.wsId &&
            focusedCell.columnWsId === (col === 1 ? 'id' : table.columns[col - FAKE_LEFT_COLUMNS]?.id.wsId),
        );

      // Debug logging for focused cells
      if (isFocused) {
        console.debug('Focused cell detected:', {
          col,
          row,
          recordId: record?.id.wsId,
          columnId: col === 1 ? 'id' : table.columns[col - FAKE_LEFT_COLUMNS]?.id.wsId,
        });
      }

      if (col === table.columns.length + 2) {
        // Updated to account for new column
        if (!isHovered) {
          return {
            kind: GridCellKind.Text,
            data: '',
            displayData: '',
            allowOverlay: false,
            readonly: true,
            themeOverride: isDeleted ? { bgCell: '#fde0e0' } : undefined,
          };
        }

        return {
          kind: GridCellKind.Text,
          data: isDeleted ? '↩️' : '🗑️',
          displayData: isDeleted ? '↩️' : '🗑️',
          readonly: true,
          allowOverlay: false,
          themeOverride: { bgCell: '#fde0e0' },
          contentAlign: 'center',
          cursor: 'pointer',
        };
      }

      if (isRecordStatusColumn(col)) {
        // Record status column - show visibility and editability icons
        if (!record) {
          return {
            kind: GridCellKind.Text,
            data: '',
            displayData: '',
            allowOverlay: false,
            readonly: true,
          };
        }

        // TODO: records field moved to different entity - temporarily show no icons
        // Only show icons if the record is present in the view config
        const displayText = '';

        return {
          kind: GridCellKind.Text,
          data: displayText,
          displayData: displayText,
          readonly: true,
          allowOverlay: false,
          contentAlign: 'center',
          themeOverride: isDeleted ? { bgCell: '#fde0e0' } : undefined,
        };
      }

      if (isIdColumn(col)) {
        const themeOverride: Partial<Theme> = {};

        // Background color logic for ID column
        if (isDeleted) {
          themeOverride.bgCell = '#fde0e0';
        } else if (editedFields?.__created) {
          themeOverride.bgCell = '#e0fde0';
        }

        // Text color logic for ID column
        // if (isFiltered) {
        //   themeOverride.textDark = '#cacaca';
        // } else if (isSuggestedDeleted) {
        // }
        themeOverride.textDark = '#b8860b'; // Yellow text for suggested deletions

        return {
          kind: GridCellKind.Text,
          data: record?.id.remoteId ?? '',
          displayData: record?.id.remoteId ?? '',
          readonly: true,
          allowOverlay: false,
          themeOverride,
        };
      }

      const column = table.columns[col - FAKE_LEFT_COLUMNS];
      const value = record?.fields[column.id.wsId];
      const isReadonly = !!column.readonly;

      // Check if there's a suggested value for this field
      const suggestedValue = suggestedValues?.[column.id.wsId];
      const hasEditedValue = editedFields?.[column.id.wsId];

      const themeOverride: Partial<Theme> = {};

      // Background color logic
      if (isDeleted) {
        themeOverride.bgCell = '#fde0e0';
      } else if (editedFields?.__created) {
        themeOverride.bgCell = '#e0fde0';
      } else if (hasEditedValue) {
        themeOverride.bgCell = '#e0fde0'; // Green for edited fields
      }

      if (suggestedValue || isSuggestedDeleted) {
        themeOverride.textDark = '#b8860b'; // Yellow text for suggested values/deletions
      }

      if (column.id.wsId === 'id' && typeof value === 'string' && value.startsWith('ws_pending_')) {
        return {
          kind: GridCellKind.Text,
          data: value,
          displayData: 'new',
          allowOverlay: false,
          readonly: true,
          themeOverride: {
            textDark: 'darkgray',
            ...themeOverride,
          },
        };
      }

      // Determine what to display
      let displayText = value ? String(value) : '';

      if (isSuggestedDeleted) {
        // Show all values as crossed out with suggestion dot for suggested deletion
        const strikethroughText = displayText
          .split('')
          .map((char) => char + '\u0336')
          .join('');
        displayText = `${strikethroughText} ●`;
      } else if (suggestedValue) {
        // Show original as crossed out using Unicode strikethrough characters whenever there's a suggested value
        const strikethroughText = displayText
          .split('')
          .map((char) => char + '\u0336')
          .join('');
        displayText = `${strikethroughText} ● ${String(suggestedValue)}`;
      }

      return {
        kind: GridCellKind.Text,
        allowOverlay: !isReadonly,
        readonly: isReadonly,
        displayData: displayText, // Show the strikethrough version for viewing
        data: value ? String(value) : '', // Keep original value for editing
        themeOverride,
      };
    },
    [sortedRecords, table.columns, hoveredRow, readFocus],
  );

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

  // Helper function to check if selected cells match a focus condition
  const checkSelectedCellsFocus = useCallback(
    (focusArray: FocusedCell[], shouldBeFocused: boolean): boolean => {
      if (!currentSelection?.current) return false;

      const { range } = currentSelection.current;
      for (let r = range.y; r < range.y + range.height; r++) {
        for (let c = range.x; c < range.x + range.width; c++) {
          if (isActionsColumn(c, table.columns.length) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
          const rec = sortedRecords?.[r];
          const colObj = table.columns[c - FAKE_LEFT_COLUMNS];
          if (rec && colObj) {
            const cell: FocusedCell = { recordWsId: rec.id.wsId, columnWsId: colObj.id.wsId };
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
    },
    [currentSelection, sortedRecords, table.columns],
  );

  const onAddRow = useCallback(() => {
    const newRecordId = generatePendingId();

    const newRecordData: Record<string, unknown> = {
      id: newRecordId,
    };

    table.columns.forEach((c) => {
      if (c.id.wsId !== 'id') {
        newRecordData[c.id.wsId] = null;
      }
    });

    const dto: BulkUpdateRecordsDto = {
      ops: [
        {
          op: 'create',
          wsId: newRecordId,
          data: newRecordData,
        },
      ],
    };
    try {
      bulkUpdateRecords(dto);
    } catch (e) {
      const error = e as Error;
      notifications.show({
        title: 'Error creating record',
        message: error.message,
        color: 'red',
      });
    }
  }, [bulkUpdateRecords, table.columns]);

  const onCellEdited = useCallback(
    async (cell: Item, newValue: EditableGridCell) => {
      if (newValue.kind !== GridCellKind.Text) {
        return;
      }

      const [col, row] = cell;
      const record = sortedRecords?.[row];
      if (!record) {
        return;
      }
      const column = table.columns[col - FAKE_LEFT_COLUMNS];
      const columnId = column.id.wsId;
      const recordId = record.id.wsId;

      const dto: BulkUpdateRecordsDto = {
        ops: [
          {
            op: 'update',
            wsId: recordId,
            data: {
              [columnId]: newValue.data,
            },
          },
        ],
      };
      try {
        await bulkUpdateRecords(dto);
      } catch (e) {
        const error = e as Error;
        notifications.show({
          title: 'Error updating record',
          message: error.message,
          color: 'red',
        });
      }
    },
    [bulkUpdateRecords, sortedRecords, table.columns],
  );

  const onGridSelectionChange = useCallback((selection: GridSelection) => {
    setCurrentSelection(selection);
  }, []);

  const onHeaderClicked = useCallback(
    (colIndex: number) => {
      if (isActionsColumn(colIndex, table.columns.length) || isIdColumn(colIndex) || isRecordStatusColumn(colIndex))
        return;
      const column = table.columns[colIndex - FAKE_LEFT_COLUMNS];
      const columnId = column.id.wsId;

      setSort((currentSort) => {
        if (currentSort?.columnId === columnId) {
          if (currentSort.dir === 'desc') {
            return undefined;
          } else {
            return {
              ...currentSort,
              dir: 'desc',
            };
          }
        }
        return { columnId, dir: 'asc' };
      });
    },
    [table.columns],
  );

  const onColumnResize = useCallback((column: GridColumn, newSize: number) => {
    if (column.id && column.id !== 'actions') {
      setColumnWidths((prev) => ({ ...prev, [column.id as string]: newSize }));
    }
  }, []);

  const onHeaderMenuClick = useCallback(
    (col: number) => {
      console.debug('Header menu clicked for column:', col);

      if (isActionsColumn(col, table.columns.length) || isRecordStatusColumn(col) || isIdColumn(col)) return;

      // Use the stored mouse position from the global mouse move handler
      const mouseX = mousePosition?.x || 0;
      const mouseY = mousePosition?.y || 0;

      console.debug('Header menu position:', { mouseX, mouseY, mousePosition });

      // Show the header menu at the mouse position
      setHeaderMenu({
        visible: true,
        x: mouseX,
        y: mouseY,
        col,
      });
    },
    [mousePosition, table.columns.length],
  );

  const handleKeyDown = useCallback(
    (e: GridKeyEventArgs) => {
      if (e.key.toLowerCase() === 'r' && e.shiftKey && currentSelection) {
        e.preventDefault();
        e.stopPropagation();

        const { records } = getGetSelectedRecordsAndColumns();
        const { columns } = getGetSelectedRecordsAndColumns();

        if (records.length > 0 && columns.length > 0) {
          let addedCount = 0;
          let removedCount = 0;

          const cellsToToggle: FocusedCell[] = [];
          const cellsToRemove: FocusedCell[] = [];

          records.forEach((record) => {
            columns.forEach((column) => {
              const cell: FocusedCell = { recordWsId: record.id.wsId, columnWsId: column.id.wsId };
              const cellKey = `${record.id.wsId}-${column.id.wsId}`;
              const existingIndex = readFocus.findIndex((fc) => `${fc.recordWsId}-${fc.columnWsId}` === cellKey);

              if (existingIndex >= 0) {
                // Remove if already focused
                cellsToRemove.push(cell);
                removedCount++;
              } else {
                // Add if not focused
                cellsToToggle.push(cell);
                addedCount++;
              }
            });
          });

          // Apply changes
          if (cellsToToggle.length > 0) {
            addReadFocus(cellsToToggle);
          }
          if (cellsToRemove.length > 0) {
            removeReadFocus(cellsToRemove);
          }

          if (addedCount > 0 && removedCount > 0) {
            notifications.show({
              title: 'Read Focus Toggled',
              message: `Added ${addedCount} and removed ${removedCount} cell(s) from read focus`,
              color: 'blue',
            });
          } else if (addedCount > 0) {
            notifications.show({
              title: 'Read Focus Added',
              message: `Added ${addedCount} cell(s) to read focus`,
              color: 'blue',
            });
          } else if (removedCount > 0) {
            notifications.show({
              title: 'Read Focus Removed',
              message: `Removed ${removedCount} cell(s) from read focus`,
              color: 'blue',
            });
          }
        }
      } else if (e.key.toLowerCase() === 'w' && e.shiftKey && currentSelection) {
        e.preventDefault();
        e.stopPropagation();

        const { records } = getGetSelectedRecordsAndColumns();
        const { columns } = getGetSelectedRecordsAndColumns();

        if (records.length > 0 && columns.length > 0) {
          let addedCount = 0;
          let removedCount = 0;

          const cellsToToggle: FocusedCell[] = [];
          const cellsToRemove: FocusedCell[] = [];

          records.forEach((record) => {
            columns.forEach((column) => {
              const cell: FocusedCell = { recordWsId: record.id.wsId, columnWsId: column.id.wsId };
              const cellKey = `${record.id.wsId}-${column.id.wsId}`;
              const existingIndex = writeFocus.findIndex((fc) => `${fc.recordWsId}-${fc.columnWsId}` === cellKey);

              if (existingIndex >= 0) {
                // Remove if already focused
                cellsToRemove.push(cell);
                removedCount++;
              } else {
                // Add if not focused
                cellsToToggle.push(cell);
                addedCount++;
              }
            });
          });

          // Apply changes
          if (cellsToToggle.length > 0) {
            addWriteFocus(cellsToToggle);
          }
          if (cellsToRemove.length > 0) {
            removeWriteFocus(cellsToRemove);
          }

          if (addedCount > 0 && removedCount > 0) {
            notifications.show({
              title: 'Write Focus Toggled',
              message: `Added ${addedCount} and removed ${removedCount} cell(s) from write focus`,
              color: 'orange',
            });
          } else if (addedCount > 0) {
            notifications.show({
              title: 'Write Focus Added',
              message: `Added ${addedCount} cell(s) to write focus`,
              color: 'orange',
            });
          } else if (removedCount > 0) {
            notifications.show({
              title: 'Write Focus Removed',
              message: `Removed ${removedCount} cell(s) from write focus`,
              color: 'orange',
            });
          }
        }
      } else if (e.key.toLowerCase() === 'c' && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();

        // Clear both focus sets when 'Shift+C' is pressed
        const totalCleared = readFocus.length + writeFocus.length;
        clearAllFocus();
        notifications.show({
          title: 'All Focus Cleared',
          message: `Cleared ${totalCleared} focused cell(s)`,
          color: 'blue',
        });
      }
    },
    [
      currentSelection,
      getGetSelectedRecordsAndColumns,
      readFocus,
      writeFocus,
      addReadFocus,
      addWriteFocus,
      removeReadFocus,
      removeWriteFocus,
      clearAllFocus,
    ],
  );

  const onCellContextMenu = useCallback(
    (cell: Item, event: CellClickedEventArgs) => {
      const [col, row] = cell;
      console.debug('Cell context menu clicked:', { col, row, event });

      // Prevent the default browser context menu
      event.preventDefault?.();

      // if (isRecordStatusColumn(col) || isIdColumn(col)) return;

      // Use the stored mouse position from the global mouse move handler
      const mouseX = mousePosition?.x || 0;
      const mouseY = mousePosition?.y || 0;

      console.debug('Using mouse position:', { mouseX, mouseY, mousePosition });

      // Show the context menu at the mouse position
      setContextMenu({
        visible: true,
        x: mouseX,
        y: mouseY,
      });
    },
    [mousePosition],
  );

  const handleContextMenuAction = useCallback(
    async (action: string) => {
      if (!contextMenu) return;

      // Get the selected records and columns from the current selection
      getGetSelectedRecordsAndColumns();

      // For cell-specific actions, check if only a single cell is selected
      const isSingleCellSelected =
        currentSelection?.current &&
        currentSelection.current.range.width === 1 &&
        currentSelection.current.range.height === 1;

      if (!isSingleCellSelected) {
        notifications.show({
          title: 'Invalid Selection',
          message: 'This action requires selecting exactly one cell',
          color: 'yellow',
        });
        setContextMenu(null);
        return;
      }

      // Get the single selected cell for cell-specific actions
      const singleCellRange = currentSelection.current.range;
      const singleCellCol = singleCellRange.x;
      const singleCellRow = singleCellRange.y;
      const singleCellRecord = sortedRecords?.[singleCellRow];
      const singleCellColumn = table.columns[singleCellCol - FAKE_LEFT_COLUMNS];

      if (
        isActionsColumn(singleCellCol, table.columns.length) ||
        isIdColumn(singleCellCol) ||
        isRecordStatusColumn(singleCellCol)
      ) {
        return;
      }

      const columnName = isIdColumn(singleCellCol) ? 'ID' : singleCellColumn?.name;
      const cellValue = isIdColumn(singleCellCol)
        ? singleCellRecord?.id.remoteId
        : singleCellRecord?.fields[singleCellColumn?.id.wsId];

      if (action === 'Accept Cell') {
        if (!singleCellRecord || isIdColumn(singleCellCol)) return;

        const columnId = singleCellColumn?.id.wsId;
        if (!columnId) return;

        try {
          await acceptCellValues([{ wsId: singleCellRecord.id.wsId, columnId }]);
          notifications.show({
            title: 'Accept Cell',
            message: `Accepted suggestion for "${columnName}"`,
            color: 'green',
          });
        } catch (e) {
          const error = e as Error;
          notifications.show({
            title: 'Error accepting cell',
            message: error.message,
            color: 'red',
          });
        }
      } else if (action === 'Reject Cell') {
        if (!singleCellRecord || isIdColumn(singleCellCol)) return;

        const columnId = singleCellColumn?.id.wsId;
        if (!columnId) return;

        try {
          await rejectCellValues([{ wsId: singleCellRecord.id.wsId, columnId }]);
          notifications.show({
            title: 'Reject Cell',
            message: `Rejected suggestion for "${columnName}"`,
            color: 'green',
          });
        } catch (e) {
          const error = e as Error;
          notifications.show({
            title: 'Error rejecting cell',
            message: error.message,
            color: 'red',
          });
        }
      } else if (action.startsWith('Accept Record')) {
        if (!singleCellRecord) return;

        // Get all columns that have suggestions for this record
        const suggestedValues = singleCellRecord.__suggested_values || {};
        const columnsWithSuggestions = Object.keys(suggestedValues).filter(
          (columnId) => suggestedValues[columnId] !== null && suggestedValues[columnId] !== undefined,
        );

        if (columnsWithSuggestions.length === 0) {
          notifications.show({
            title: 'Accept Record',
            message: 'No suggestions found for this record',
            color: 'yellow',
          });
          return;
        }

        try {
          // Create items array for all columns with suggestions
          const items = columnsWithSuggestions.map((columnId) => ({
            wsId: singleCellRecord.id.wsId,
            columnId,
          }));

          await acceptCellValues(items);
          notifications.show({
            title: 'Accept Record',
            message: `Accepted ${columnsWithSuggestions.length} suggestion${columnsWithSuggestions.length > 1 ? 's' : ''} for this record`,
            color: 'green',
          });
        } catch (e) {
          const error = e as Error;
          notifications.show({
            title: 'Error accepting record',
            message: error.message,
            color: 'red',
          });
        }
      } else if (action.startsWith('Reject Record')) {
        if (!singleCellRecord) return;

        // Get all columns that have suggestions for this record
        const suggestedValues = singleCellRecord.__suggested_values || {};
        const columnsWithSuggestions = Object.keys(suggestedValues).filter(
          (columnId) => suggestedValues[columnId] !== null && suggestedValues[columnId] !== undefined,
        );

        if (columnsWithSuggestions.length === 0) {
          notifications.show({
            title: 'Reject Record',
            message: 'No suggestions found for this record',
            color: 'yellow',
          });
          return;
        }

        try {
          // Create items array for all columns with suggestions
          const items = columnsWithSuggestions.map((columnId) => ({
            wsId: singleCellRecord.id.wsId,
            columnId,
          }));

          await rejectCellValues(items);
          notifications.show({
            title: 'Reject Record',
            message: `Rejected ${columnsWithSuggestions.length} suggestion${columnsWithSuggestions.length > 1 ? 's' : ''} for this record`,
            color: 'green',
          });
        } catch (e) {
          const error = e as Error;
          notifications.show({
            title: 'Error rejecting record',
            message: error.message,
            color: 'red',
          });
        }
      } else {
        notifications.show({
          title: `${action}`,
          message: `${action} action for "${columnName}" (${cellValue}) - coming soon!`,
          color: 'blue',
        });
      }

      // Close the context menu
      setContextMenu(null);
    },
    [
      contextMenu,
      getGetSelectedRecordsAndColumns,
      currentSelection,
      sortedRecords,
      table.columns,
      table.id.wsId,
      readFocus,
      writeFocus,
      snapshot.id,
      refreshRecords,
      acceptCellValues,
      rejectCellValues,
      addReadFocus,
      addWriteFocus,
      removeReadFocus,
      removeWriteFocus,
    ],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const closeHeaderMenu = useCallback(() => {
    setHeaderMenu(null);
  }, []);

  const handleHeaderMenuAction = useCallback(
    async (action: string) => {
      if (!headerMenu) return;

      const { col } = headerMenu;
      const columnName = isIdColumn(col) ? 'ID' : table.columns[col - FAKE_LEFT_COLUMNS]?.name;

      if (action === 'Accept Column') {
        if (isIdColumn(col)) return;

        const columnId = table.columns[col - FAKE_LEFT_COLUMNS]?.id.wsId;
        if (!columnId) return;

        // Find all records that have suggestions for this column
        const recordsWithSuggestions =
          sortedRecords?.filter((record) => {
            const suggestedValues = record.__suggested_values || {};
            return suggestedValues[columnId] !== null && suggestedValues[columnId] !== undefined;
          }) || [];

        if (recordsWithSuggestions.length === 0) {
          notifications.show({
            title: 'Accept Column',
            message: `No suggestions found for column "${columnName}"`,
            color: 'yellow',
          });
          return;
        }

        try {
          // Create items array for all records with suggestions for this column
          const items = recordsWithSuggestions.map((record) => ({
            wsId: record.id.wsId,
            columnId,
          }));

          await acceptCellValues(items);
          notifications.show({
            title: 'Accept Column',
            message: `Accepted ${recordsWithSuggestions.length} suggestion${recordsWithSuggestions.length > 1 ? 's' : ''} for column "${columnName}"`,
            color: 'green',
          });
        } catch (e) {
          const error = e as Error;
          notifications.show({
            title: 'Error accepting column',
            message: error.message,
            color: 'red',
          });
        }
      } else if (action === 'Reject Column') {
        if (isIdColumn(col)) return;

        const columnId = table.columns[col - FAKE_LEFT_COLUMNS]?.id.wsId;
        if (!columnId) return;

        // Find all records that have suggestions for this column
        const recordsWithSuggestions =
          sortedRecords?.filter((record) => {
            const suggestedValues = record.__suggested_values || {};
            return suggestedValues[columnId] !== null && suggestedValues[columnId] !== undefined;
          }) || [];

        if (recordsWithSuggestions.length === 0) {
          notifications.show({
            title: 'Reject Column',
            message: `No suggestions found for column "${columnName}"`,
            color: 'yellow',
          });
          return;
        }

        try {
          // Create items array for all records with suggestions for this column
          const items = recordsWithSuggestions.map((record) => ({
            wsId: record.id.wsId,
            columnId,
          }));

          await rejectCellValues(items);
          notifications.show({
            title: 'Reject Column',
            message: `Rejected ${recordsWithSuggestions.length} suggestion${recordsWithSuggestions.length > 1 ? 's' : ''} for column "${columnName}"`,
            color: 'green',
          });
        } catch (e) {
          const error = e as Error;
          notifications.show({
            title: 'Error rejecting column',
            message: error.message,
            color: 'red',
          });
        }
      } else if (
        action.includes('Hide') ||
        action.includes('Unhide') ||
        action.includes('Protect') ||
        action.includes('Unprotect')
      ) {
        if (isIdColumn(col)) return;

        const columnId = table.columns[col - FAKE_LEFT_COLUMNS]?.id.wsId;
        if (!columnId) return;

        try {
          // Determine what to do based on the action
          const isUnsetAction = action.startsWith('Unhide') || action.startsWith('Unprotect');
          const isHideAction = action.includes('Hide') || action.includes('Unhide');
          const isProtectAction = action.includes('Protect') || action.includes('Unprotect');

          if (!isHideAction && !isProtectAction) {
            notifications.show({
              title: 'Invalid Action',
              message: 'Unknown column action',
              color: 'red',
            });
            return;
          }

          if (currentViewId && activeView) {
            // Update existing view
            const existingConfig = activeView.config;
            const tableConfig = existingConfig[table.id.wsId] || {
              hidden: false,
              protected: false,
              columns: [],
            };

            // Find existing column config or create new one
            const columns = tableConfig.columns || [];
            const existingColumnIndex = columns.findIndex((c: { wsId: string }) => c.wsId === columnId);
            const existingColumn = existingColumnIndex >= 0 ? columns[existingColumnIndex] : null;

            let updatedColumn;
            if (isUnsetAction) {
              // Remove the specific override (hidden or protected)
              if (isHideAction) {
                // Remove hidden override, keep protected override if it exists
                updatedColumn = {
                  wsId: columnId,
                  ...(existingColumn?.protected !== undefined && { protected: existingColumn.protected }),
                };
              } else {
                // Remove protected override, keep hidden override if it exists
                updatedColumn = {
                  wsId: columnId,
                  ...(existingColumn?.hidden !== undefined && { hidden: existingColumn.hidden }),
                };
              }
            } else {
              // Set a specific value - only include the property being set
              if (isHideAction) {
                const newHidden = action.includes('Hide');
                updatedColumn = {
                  wsId: columnId,
                  hidden: newHidden,
                  ...(existingColumn?.protected !== undefined && { protected: existingColumn.protected }),
                };
              } else {
                const newProtected = action.includes('Protect');
                updatedColumn = {
                  wsId: columnId,
                  protected: newProtected,
                  ...(existingColumn?.hidden !== undefined && { hidden: existingColumn.hidden }),
                };
              }
            }

            // Update or add the column
            const updatedColumns = [...columns];
            if (existingColumnIndex >= 0) {
              if (Object.keys(updatedColumn).length === 1) {
                // Only has wsId, remove the column entirely
                updatedColumns.splice(existingColumnIndex, 1);
              } else {
                updatedColumns[existingColumnIndex] = updatedColumn;
              }
            } else if (Object.keys(updatedColumn).length > 1) {
              // Only add if it has more than just wsId
              updatedColumns.push(updatedColumn);
            }

            const updatedTableConfig = {
              ...tableConfig,
              columns: updatedColumns,
            };

            const updatedConfig = {
              ...existingConfig,
              [table.id.wsId]: updatedTableConfig,
            };

            await upsertView({
              id: activeView.id,
              name: activeView.name || undefined,
              snapshotId: snapshot.id,
              config: updatedConfig,
            });

            const actionType = isUnsetAction
              ? 'unset'
              : isHideAction
                ? 'hidden' in updatedColumn && updatedColumn.hidden
                  ? 'hidden'
                  : 'unhidden'
                : 'protected' in updatedColumn && updatedColumn.protected
                  ? 'protected'
                  : 'unprotected';
            notifications.show({
              title: 'Column Updated',
              message: `Column ${actionType}`,
              color: 'green',
            });
          } else {
            // Create a new view with this column setting
            const tableDefaults = {
              hidden: false,
              protected: false,
            };

            let columnConfig;
            if (isUnsetAction) {
              // For unset actions, don't create a new view
              notifications.show({
                title: 'No View',
                message: 'No active view to unset column settings from',
                color: 'yellow',
              });
              return;
            } else {
              if (isHideAction) {
                const newHidden = action.includes('Hide');
                columnConfig = {
                  wsId: columnId,
                  hidden: newHidden,
                };
              } else {
                const newProtected = action.includes('Protect');
                columnConfig = {
                  wsId: columnId,
                  protected: newProtected,
                };
              }
            }

            const viewConfig = {
              [table.id.wsId]: {
                hidden: tableDefaults.hidden,
                protected: tableDefaults.protected,
                columns: [columnConfig],
              },
            };

            const result = await upsertView({
              snapshotId: snapshot.id,
              config: viewConfig,
            });

            notifications.show({
              title: 'Column Updated',
              message: `Column ${isHideAction ? (columnConfig.hidden ? 'hidden' : 'unhidden') : columnConfig.protected ? 'protected' : 'unprotected'}`,
              color: 'green',
            });

            // Select the newly created view
            setCurrentViewId(result.id);
          }

          // Refresh the views list
          refreshViews?.();
        } catch (e) {
          const error = e as Error;
          notifications.show({
            title: 'Error updating column',
            message: error.message,
            color: 'red',
          });
        }
      } else {
        notifications.show({
          title: `${action}`,
          message: `${action} action for column "${columnName}" - coming soon!`,
          color: 'blue',
        });
      }

      // Close the header menu
      setHeaderMenu(null);
    },
    [
      headerMenu,
      table.columns,
      sortedRecords,
      acceptCellValues,
      rejectCellValues,
      upsertView,
      refreshViews,
      snapshot.id,
      table.id.wsId,
      currentViewId,
      activeView,
      setCurrentViewId,
    ],
  );

  const getContextMenuItems = useCallback(() => {
    if (!contextMenu) return [];

    // Get the selected records and columns from the current selection
    getGetSelectedRecordsAndColumns();

    const hasUnfocusedReadCells = checkSelectedCellsFocus(readFocus, false);
    const hasFocusedReadCells = checkSelectedCellsFocus(readFocus, true);
    const hasUnfocusedWriteCells = checkSelectedCellsFocus(writeFocus, false);
    const hasFocusedWriteCells = checkSelectedCellsFocus(writeFocus, true);

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
          const newCells: FocusedCell[] = [];
          if (currentSelection.current) {
            const { range } = currentSelection.current;
            for (let r = range.y; r < range.y + range.height; r++) {
              for (let c = range.x; c < range.x + range.width; c++) {
                if (isActionsColumn(c, table.columns.length) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
                const rec = sortedRecords?.[r];
                const colObj = table.columns[c - FAKE_LEFT_COLUMNS];
                if (rec && colObj) {
                  const cell: FocusedCell = { recordWsId: rec.id.wsId, columnWsId: colObj.id.wsId };
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
          const cellsToRemove: FocusedCell[] = [];
          if (currentSelection.current) {
            const { range } = currentSelection.current;
            for (let r = range.y; r < range.y + range.height; r++) {
              for (let c = range.x; c < range.x + range.width; c++) {
                if (isActionsColumn(c, table.columns.length) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
                const rec = sortedRecords?.[r];
                const colObj = table.columns[c - FAKE_LEFT_COLUMNS];
                if (rec && colObj) {
                  const cell: FocusedCell = { recordWsId: rec.id.wsId, columnWsId: colObj.id.wsId };
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
          const newCells: FocusedCell[] = [];
          if (currentSelection.current) {
            const { range } = currentSelection.current;
            for (let r = range.y; r < range.y + range.height; r++) {
              for (let c = range.x; c < range.x + range.width; c++) {
                if (isActionsColumn(c, table.columns.length) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
                const rec = sortedRecords?.[r];
                const colObj = table.columns[c - FAKE_LEFT_COLUMNS];
                if (rec && colObj) {
                  const cell: FocusedCell = { recordWsId: rec.id.wsId, columnWsId: colObj.id.wsId };
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
          const cellsToRemove: FocusedCell[] = [];
          if (currentSelection.current) {
            const { range } = currentSelection.current;
            for (let r = range.y; r < range.y + range.height; r++) {
              for (let c = range.x; c < range.x + range.width; c++) {
                if (isActionsColumn(c, table.columns.length) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
                const rec = sortedRecords?.[r];
                const colObj = table.columns[c - FAKE_LEFT_COLUMNS];
                if (rec && colObj) {
                  const cell: FocusedCell = { recordWsId: rec.id.wsId, columnWsId: colObj.id.wsId };
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
            await snapshotApi.addRecordsToActiveFilter(snapshot.id, table.id.wsId, selectedRecordIds);
            notifications.show({
              title: 'Filter Updated',
              message: `Added ${selectedRecordIds.length} record(s) to active filter`,
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

    // For cell-specific actions, check if only a single cell is selected
    const isSingleCellSelected =
      currentSelection?.current &&
      currentSelection.current.range.width === 1 &&
      currentSelection.current.range.height === 1;

    if (isSingleCellSelected) {
      // Get the single selected cell for cell-specific actions
      const singleCellRange = currentSelection.current.range;
      const singleCellCol = singleCellRange.x;
      const singleCellRow = singleCellRange.y;
      const singleCellRecord = sortedRecords?.[singleCellRow];
      const singleCellColumn = table.columns[singleCellCol - FAKE_LEFT_COLUMNS];

      if (
        singleCellRecord &&
        singleCellColumn &&
        !isActionsColumn(singleCellCol, table.columns.length) &&
        !isIdColumn(singleCellCol) &&
        !isRecordStatusColumn(singleCellCol)
      ) {
        // Check if there's a suggested value for this specific cell
        const hasCellSuggestion = !!singleCellRecord.__suggested_values?.[singleCellColumn.id.wsId];

        // Check if there are any suggested values for any field in this record
        const recordSuggestions = singleCellRecord.__suggested_values
          ? Object.keys(singleCellRecord.__suggested_values)
          : [];
        const hasRecordSuggestions = recordSuggestions.length > 0;

        if (hasCellSuggestion) {
          items.push({
            label: 'Accept Cell',
            disabled: false,
            group: ACCEPT_REJECT_GROUP_NAME,
            leftSection: <CheckIcon size={MENU_ICON_SIZE} color="#00aa00" />,
          });
          items.push({
            label: 'Reject Cell',
            disabled: false,
            group: ACCEPT_REJECT_GROUP_NAME,
            leftSection: <XIcon size={MENU_ICON_SIZE} color="#ff0000" />,
          });
        }

        if (hasRecordSuggestions) {
          const suggestionCount = recordSuggestions.length;
          const suggestionText = suggestionCount === 1 ? 'suggestion' : 'suggestions';
          items.push({
            label: `Accept Record (${suggestionCount} ${suggestionText})`,
            disabled: false,
            group: ACCEPT_REJECT_GROUP_NAME,
            leftSection: <ListChecksIcon size={MENU_ICON_SIZE} color="#00aa00" />,
          });
          items.push({
            label: `Reject Record (${suggestionCount} ${suggestionText})`,
            disabled: false,
            group: ACCEPT_REJECT_GROUP_NAME,
            leftSection: <ListBulletsIcon size={MENU_ICON_SIZE} color="#ff0000" />,
          });
        }
      }
    }

    if (items.length === 0) {
      items.push({ label: 'No actions', disabled: true });
    }

    return items;
  }, [
    contextMenu,
    sortedRecords,
    table.columns,
    currentSelection,
    readFocus,
    writeFocus,
    getGetSelectedRecordsAndColumns,
    checkSelectedCellsFocus,
  ]);

  const getHeaderMenuItems = useCallback((): Array<{
    label: string;
    disabled: boolean;
    leftSection?: React.ReactNode;
    group?: string;
  }> => {
    if (!headerMenu) return [];

    const { col } = headerMenu;

    if (isActionsColumn(col, table.columns.length) || isIdColumn(col) || isRecordStatusColumn(col)) {
      return [{ label: 'No actions', disabled: true }];
    }

    const column = table.columns[col - FAKE_LEFT_COLUMNS];
    if (!column) {
      return [{ label: 'No actions', disabled: true }];
    }

    // Check if any record has a suggested value for this column
    const hasColumnSuggestions = sortedRecords?.some((record) => record.__suggested_values?.[column.id.wsId]);

    const items: Array<{ label: string; disabled: boolean; leftSection?: React.ReactNode; group?: string }> = [];

    if (hasColumnSuggestions) {
      items.push({
        label: 'Accept Column',
        disabled: false,
        group: ACCEPT_REJECT_GROUP_NAME,
        leftSection: <ListChecksIcon size={MENU_ICON_SIZE} color="#00aa00" />,
      });
      items.push({
        label: 'Reject Column',
        disabled: false,
        group: ACCEPT_REJECT_GROUP_NAME,
        leftSection: <ListBulletsIcon size={MENU_ICON_SIZE} color="#ff0000" />,
      });
    }

    // Get table defaults and current column status
    const tableConfig = activeView?.config[table.id.wsId];

    // COLUMN CONTEXT MENU LOGIC
    const columnConfig = tableConfig?.columns?.find((c: { wsId: string }) => c.wsId === column.id.wsId);
    const hasColumnHiddenOverride = columnConfig && columnConfig.hidden !== undefined;
    const hasColumnProtectedOverride = columnConfig && columnConfig.protected !== undefined;

    // Hide/Unhide
    if (hasColumnHiddenOverride) {
      items.push({
        label: 'Unhide Column',
        disabled: false,
        group: COLUMN_VIEW_GROUP_NAME,
        leftSection: '👁️',
      });
    } else {
      items.push({
        label: 'Hide Column',
        disabled: false,
        group: COLUMN_VIEW_GROUP_NAME,
        leftSection: ICONS.hidden,
      });
    }
    // Protect/Unprotect
    if (hasColumnProtectedOverride) {
      items.push({
        label: 'Unprotect Column',
        disabled: false,
        group: COLUMN_VIEW_GROUP_NAME,
        leftSection: ICONS.editable,
      });
    } else {
      items.push({
        label: 'Protect Column',
        disabled: false,
        group: COLUMN_VIEW_GROUP_NAME,
        leftSection: ICONS.protected,
      });
    }

    if (items.length === 0) {
      items.push({ label: 'No actions', disabled: true });
    }

    return items;
  }, [headerMenu, sortedRecords, table.columns, activeView, table.id.wsId]);

  const columns: GridColumn[] = useMemo(() => {
    const baseColumns: GridColumn[] = table.columns.map((c) => {
      // Only show icons if the column is present in the view config
      let titleWithIcons = titleWithSort(c, sort);

      if (activeView && activeView.config[table.id.wsId]) {
        const tableConfig = activeView.config[table.id.wsId];
        const columnConfig = tableConfig.columns?.find((col: { wsId: string }) => col.wsId === c.id.wsId);

        if (columnConfig) {
          // Column is in the config, show icons only for explicitly overridden properties
          let icons = '';

          // Only show hidden icon if explicitly set
          if ('hidden' in columnConfig) {
            const hiddenIcon = columnConfig.hidden ? ICONS.hidden : ICONS.visible;
            icons += hiddenIcon;
          }

          // Only show protected icon if explicitly set
          if ('protected' in columnConfig) {
            const protectedIcon = columnConfig.protected ? ICONS.protected : ICONS.editable;
            icons += protectedIcon;
          }

          if (icons) {
            titleWithIcons = `${titleWithSort(c, sort)} ${icons}`;
          }
        }
        // If column is not in config, don't show any icons
      }

      return {
        title: titleWithIcons,
        id: c.id.wsId,
        width: columnWidths[c.id.wsId] ?? 150,
        menuIcon: GridColumnMenuIcon.Dots,
        icon: getColumnIcon(c),
        hasMenu: true,
        ...(c.readonly && {
          themeOverride: {
            bgCell: '#F7F7F7',
          },
        }),
      } satisfies GridColumn;
    });

    const result = [
      {
        title: '',
        id: 'record-status',
        width: 60,
        themeOverride: { bgCell: '#F7F7F7' },
        // menuIcon: GridColumnMenuIcon.Dots,
        // icon: GridColumnIcon.HeaderRowID,
        // hasMenu: true,
      },
      {
        title: 'ID',
        id: 'id',
        width: 150,
        themeOverride: { bgCell: '#F7F7F7' },
        // menuIcon: GridColumnMenuIcon.Dots,
        icon: GridColumnIcon.HeaderRowID, // ID is typically a string identifier
        // hasMenu: true,
      },
      ...baseColumns,
      {
        id: 'actions',
        title: '',
        width: 35,
        // No menu icon for actions column
      },
    ];

    console.debug('Columns created:', result);
    return result;
  }, [table.columns, table.id.wsId, sort, activeView, columnWidths]);

  const value: SnapshotTableGridContextValue = {
    mousePosition,
    setHoveredRow,
    modalStack,
    error,
    isLoading,
    records,
    readFocus,
    writeFocus,
    columns,
    sortedRecords,
    currentSelection,
    getCellContent,
    onCellEdited,
    onColumnResize,
    closeContextMenu,
    closeHeaderMenu,
    onHeaderClicked,
    onCellClicked,
    onGridSelectionChange,
    onHeaderMenuClick,
    onCellContextMenu,
    handleKeyDown,
    onAddRow,
    contextMenu,
    getContextMenuItems,
    getHeaderMenuItems,
    headerMenu,
    hoveredRow,
    handleContextMenuAction,
    handleHeaderMenuAction,
    table,
  };

  return <SnapshotTableGridContext.Provider value={value}>{children}</SnapshotTableGridContext.Provider>;
};

export interface SnapshotTableGridContextValue {
  mousePosition: { x: number; y: number } | null;
  setHoveredRow: (row: number | undefined) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modalStack: any;
  error: Error | undefined;
  isLoading: boolean;
  records: SnapshotRecord[] | undefined;
  readFocus: FocusedCell[];
  writeFocus: FocusedCell[];
  columns: GridColumn[];
  sortedRecords: SnapshotRecord[] | undefined;
  currentSelection: GridSelection | undefined;
  getCellContent: (cell: Item) => GridCell;
  onCellEdited: (cell: Item, newValue: EditableGridCell) => void;
  onColumnResize: (column: GridColumn, newSize: number) => void;
  closeContextMenu: () => void;
  closeHeaderMenu: () => void;
  onHeaderClicked: (colIndex: number) => void;
  onCellClicked: (cell: Item, event: CellClickedEventArgs) => void;
  onGridSelectionChange: (selection: GridSelection) => void;
  onHeaderMenuClick: (colIndex: number) => void;
  onCellContextMenu: (cell: Item, event: CellClickedEventArgs) => void;
  handleKeyDown: (e: GridKeyEventArgs) => void;
  onAddRow: () => void;
  contextMenu: ContextMenu | null;
  getContextMenuItems: () => MenuItem[];
  getHeaderMenuItems: () => Array<{ label: string; disabled: boolean; leftSection?: React.ReactNode; group?: string }>;
  headerMenu: { visible: boolean; x: number; y: number } | null;
  hoveredRow: number | undefined;
  handleContextMenuAction: (action: string) => void;
  handleHeaderMenuAction: (action: string) => void;
  table: TableSpec;
}

export const useSnapshotTableGridContext = () => {
  const context = useContext(SnapshotTableGridContext);
  if (!context) {
    throw new Error('useSnapshotTableGridContext must be used within SnapshotTableGridProvider');
  }
  return context;
};
