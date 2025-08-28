'use client';

import { useSnapshotContext } from '@/app/snapshots/[...slug]/SnapshotContext';
import { useAgentChatContext } from '@/contexts/agent-chat-context';
import { RecordCell } from '@/types/common';
import { BulkUpdateRecordsDto } from '@/types/server-entities/records';
import { Snapshot, SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
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
import { ListBulletsIcon, ListChecksIcon } from '@phosphor-icons/react';
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { useSnapshotTableRecords } from '../../../../../hooks/use-snapshot-table-records';
import { useUpsertView } from '../../../../../hooks/use-view';
import { ICONS } from '../../icons';
import { ContextMenu, MenuItem } from '../types';
import { ACCEPT_REJECT_GROUP_NAME, COLUMN_VIEW_GROUP_NAME, MENU_ICON_SIZE } from './menus/constants';
import { useContextMenuItems } from './useContextMenuItems';
import { useCoreGridHandlers } from './useCoreGridHandlers';
import { useCoreGridState } from './useCoreGridState';
import { useMousePosition } from './useMousePosition';
import { useProcessedSelection } from './useProcessedSelection';
import {
  FAKE_LEFT_COLUMNS,
  generatePendingId,
  getColumnIcon,
  isActionsColumn,
  isIdColumn,
  isRecordStatusColumn,
  isSpecialColumn,
  SortState,
  titleWithSort,
} from './utils/helpers';
import { findSelectedCellsAndRecordsWithSuggestions } from './utils/selectionUtils';

const SnapshotTableGridContext = createContext<SnapshotTableGridContextValue | undefined>(undefined);

interface SnapshotTableGridProps {
  snapshot: Snapshot;
  table: TableSpec;
  onSwitchToRecordView: (recordId: string, columnId?: string) => void;
}

export const SnapshotTableGridProvider = ({
  children,
  snapshot,
  table,
  onSwitchToRecordView,
}: SnapshotTableGridProps & { children: ReactNode }) => {
  // From higher level contexts
  const { refreshViews, setCurrentViewId, currentView, currentViewId, viewDataAsAgent } = useSnapshotContext();
  const { readFocus, writeFocus, addReadFocus, addWriteFocus, removeReadFocus, removeWriteFocus, clearAllFocus } =
    useAgentChatContext();

  // State from hooks on this level
  const coreGridState = useCoreGridState();
  const coreGridHandlers = useCoreGridHandlers(coreGridState);
  const { currentSelection, columnWidths } = coreGridState;

  // Internal state
  const mousePosition = useMousePosition();
  const modalStack = useModalsStack(['focusedCellsDebug']);

  // SWR:
  const { upsertView } = useUpsertView();

  const [sort, setSort] = useState<SortState | undefined>();
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [headerMenu, setHeaderMenu] = useState<{
    x: number;
    y: number;
    col: number;
  } | null>(null);

  const { records, isLoading, error, bulkUpdateRecords, acceptCellValues, rejectCellValues, refreshRecords } =
    useSnapshotTableRecords({
      snapshotId: snapshot.id,
      tableId: table.id.wsId,
      viewId: viewDataAsAgent && currentViewId ? currentViewId : undefined,
    });

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

  const columns: GridColumn[] = useMemo(() => {
    const baseColumns: GridColumn[] = table.columns.map((c) => {
      // Only show icons if the column is present in the view config
      let titleWithIcons = titleWithSort(c, sort);

      if (currentView && currentView.config[table.id.wsId]) {
        const tableConfig = currentView.config[table.id.wsId];
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

    return result;
  }, [table.columns, table.id.wsId, sort, currentView, columnWidths]);

  const processedSelection = useProcessedSelection(currentSelection, sortedRecords, table);
  const { selectedRecordsAndColumns } = processedSelection;
  const { records: selectedRecords, columns: selectedColumns } = selectedRecordsAndColumns;

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
      const isHovered = coreGridState.hoveredRow === row;
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
    [sortedRecords, table.columns, coreGridState.hoveredRow, readFocus],
  );

  const onAddRow = useCallback(async () => {
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
      await bulkUpdateRecords(dto);
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

        const { records, columns } = processedSelection.selectedRecordsAndColumns;

        if (records.length > 0 && columns.length > 0) {
          let addedCount = 0;
          let removedCount = 0;

          const cellsToToggle: RecordCell[] = [];
          const cellsToRemove: RecordCell[] = [];

          records.forEach((record) => {
            columns.forEach((column) => {
              const cell: RecordCell = { recordWsId: record.id.wsId, columnWsId: column.id.wsId };
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

        // const { records } = getGetSelectedRecordsAndColumns();
        // const { columns } = getGetSelectedRecordsAndColumns();

        if (selectedRecords.length > 0 && selectedColumns.length > 0) {
          let addedCount = 0;
          let removedCount = 0;

          const cellsToToggle: RecordCell[] = [];
          const cellsToRemove: RecordCell[] = [];

          selectedRecords.forEach((record) => {
            selectedColumns.forEach((column) => {
              const cell: RecordCell = { recordWsId: record.id.wsId, columnWsId: column.id.wsId };
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
      processedSelection.selectedRecordsAndColumns,
      readFocus,
      addReadFocus,
      removeReadFocus,
      selectedRecords,
      selectedColumns,
      writeFocus,
      addWriteFocus,
      removeWriteFocus,
      clearAllFocus,
    ],
  );

  const onCellContextMenu = useCallback(
    (cell: Item, event: CellClickedEventArgs) => {
      event.preventDefault?.();
      const mouseX = mousePosition?.x || 0;
      const mouseY = mousePosition?.y || 0;
      setContextMenu({ x: mouseX, y: mouseY });
    },
    [mousePosition],
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

          if (currentViewId && currentView) {
            // Update existing view
            const existingConfig = currentView.config;
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
              id: currentView.id,
              name: currentView.name || undefined,
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
      table.id.wsId,
      sortedRecords,
      acceptCellValues,
      rejectCellValues,
      currentViewId,
      currentView,
      refreshViews,
      upsertView,
      snapshot.id,
      setCurrentViewId,
    ],
  );

  const handleAcceptCell = useCallback(async () => {
    if (!contextMenu) return;

    const { cells: itemsToAccept } = findSelectedCellsAndRecordsWithSuggestions(currentSelection, sortedRecords);
    const totalSuggestions = itemsToAccept.length;

    if (itemsToAccept.length === 0) {
      notifications.show({
        title: 'Accept Selected Suggestions',
        message: 'No suggestions found in selected cells',
        color: 'yellow',
      });
      setContextMenu(null);
      return;
    }

    try {
      await acceptCellValues(itemsToAccept);
      notifications.show({
        title: 'Accept Selected Suggestions',
        message: `Accepted ${totalSuggestions} suggestion${totalSuggestions > 1 ? 's' : ''} in selected cells`,
        color: 'green',
      });
    } catch (e) {
      const error = e as Error;
      notifications.show({
        title: 'Error accepting suggestions',
        message: error.message,
        color: 'red',
      });
    }
  }, [contextMenu, currentSelection, sortedRecords, acceptCellValues, setContextMenu]);

  const handleRejectCell = useCallback(async () => {
    if (!contextMenu) return;

    const { cells: itemsToReject } = findSelectedCellsAndRecordsWithSuggestions(currentSelection, sortedRecords);
    const totalSuggestions = itemsToReject.length;

    if (itemsToReject.length === 0) {
      notifications.show({
        title: 'Reject Selected Suggestions',
        message: 'No suggestions found in selected cells',
        color: 'yellow',
      });
      setContextMenu(null);
      return;
    }

    try {
      await rejectCellValues(itemsToReject);
      notifications.show({
        title: 'Reject Selected Suggestions',
        message: `Rejected ${totalSuggestions} suggestion${totalSuggestions > 1 ? 's' : ''} in selected cells`,
        color: 'green',
      });
    } catch (e) {
      const error = e as Error;
      notifications.show({
        title: 'Error rejecting suggestions',
        message: error.message,
        color: 'red',
      });
    }
  }, [contextMenu, currentSelection, sortedRecords, rejectCellValues, setContextMenu]);

  const handleAcceptRecords = useCallback(async () => {
    if (!contextMenu || !currentSelection) return;

    // Get all selected records
    const selectedRecords: SnapshotRecord[] = [];

    if (currentSelection.current) {
      const { range } = currentSelection.current;
      for (let r = range.y; r < range.y + range.height; r++) {
        const record = sortedRecords?.[r];
        if (record) {
          selectedRecords.push(record);
        }
      }
    }

    if (currentSelection.rows) {
      for (const row of currentSelection.rows) {
        const record = sortedRecords?.[row];
        if (record) {
          selectedRecords.push(record);
        }
      }
    }

    if (selectedRecords.length === 0) {
      notifications.show({
        title: 'No Records Selected',
        message: 'Please select one or more records to accept',
        color: 'yellow',
      });
      setContextMenu(null);
      return;
    }

    const { allSuggestedCellsForSelectedRecords: itemsToAccept } = findSelectedCellsAndRecordsWithSuggestions(
      currentSelection,
      sortedRecords,
    );
    const totalSuggestions = itemsToAccept.length;

    if (itemsToAccept.length === 0) {
      notifications.show({
        title: 'Accept Records',
        message: 'No suggestions found for the selected records',
        color: 'yellow',
      });
      return;
    }

    try {
      await acceptCellValues(itemsToAccept);
      notifications.show({
        title: 'Accept Records',
        message: `Accepted ${totalSuggestions} suggestion${totalSuggestions > 1 ? 's' : ''} across ${selectedRecords.length} record${selectedRecords.length > 1 ? 's' : ''}`,
        color: 'green',
      });
    } catch (e) {
      const error = e as Error;
      notifications.show({
        title: 'Error accepting records',
        message: error.message,
        color: 'red',
      });
    }
  }, [contextMenu, currentSelection, sortedRecords, acceptCellValues]);

  const handleRejectRecords = useCallback(async () => {
    if (!contextMenu || !currentSelection) return;

    // Get all selected records
    const selectedRecords: SnapshotRecord[] = [];

    if (currentSelection.current) {
      const { range } = currentSelection.current;
      for (let r = range.y; r < range.y + range.height; r++) {
        const record = sortedRecords?.[r];
        if (record) {
          selectedRecords.push(record);
        }
      }
    }

    if (currentSelection.rows) {
      for (const row of currentSelection.rows) {
        const record = sortedRecords?.[row];
        if (record) {
          selectedRecords.push(record);
        }
      }
    }

    if (selectedRecords.length === 0) {
      notifications.show({
        title: 'No Records Selected',
        message: 'Please select one or more records to reject',
        color: 'yellow',
      });
      setContextMenu(null);
      return;
    }

    const { allSuggestedCellsForSelectedRecords: itemsToReject } = findSelectedCellsAndRecordsWithSuggestions(
      currentSelection,
      sortedRecords,
    );
    const totalSuggestions = itemsToReject.length;

    if (itemsToReject.length === 0) {
      notifications.show({
        title: 'Reject Records',
        message: 'No suggestions found for the selected records',
        color: 'yellow',
      });
      return;
    }

    try {
      await rejectCellValues(itemsToReject);
      notifications.show({
        title: 'Reject Records',
        message: `Rejected ${totalSuggestions} suggestion${totalSuggestions > 1 ? 's' : ''} across ${selectedRecords.length} record${selectedRecords.length > 1 ? 's' : ''}`,
        color: 'green',
      });
    } catch (e) {
      const error = e as Error;
      notifications.show({
        title: 'Error rejecting records',
        message: error.message,
        color: 'red',
      });
    }
  }, [contextMenu, currentSelection, sortedRecords, rejectCellValues]);

  const { getContextMenuItems } = useContextMenuItems(
    contextMenu,
    setContextMenu,
    currentSelection,
    table,
    sortedRecords,
    snapshot,
    handleAcceptRecords,
    handleRejectRecords,
    handleAcceptCell,
    handleRejectCell,
    refreshRecords,
    (recordId: string) => {
      onSwitchToRecordView(recordId);
    },
  );

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
    const tableConfig = currentView?.config[table.id.wsId];

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
  }, [headerMenu, sortedRecords, table.columns, currentView, table.id.wsId]);

  const value: SnapshotTableGridContextValue = {
    coreGridState,
    coreGridHandlers,
    mousePosition,
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
    closeContextMenu,
    closeHeaderMenu,
    onHeaderClicked,
    onCellClicked,
    onHeaderMenuClick,
    onCellContextMenu,
    handleKeyDown,
    onAddRow,
    contextMenu,
    getContextMenuItems,
    getHeaderMenuItems,
    headerMenu,
    handleHeaderMenuAction,
    table,
  };

  return <SnapshotTableGridContext.Provider value={value}>{children}</SnapshotTableGridContext.Provider>;
};

export interface SnapshotTableGridContextValue {
  coreGridState: ReturnType<typeof useCoreGridState>;
  coreGridHandlers: ReturnType<typeof useCoreGridHandlers>;
  mousePosition: { x: number; y: number } | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modalStack: any;
  error: Error | undefined;
  isLoading: boolean;
  records: SnapshotRecord[] | undefined;
  readFocus: RecordCell[];
  writeFocus: RecordCell[];
  columns: GridColumn[];
  sortedRecords: SnapshotRecord[] | undefined;
  currentSelection: GridSelection | undefined;
  getCellContent: (cell: Item) => GridCell;
  onCellEdited: (cell: Item, newValue: EditableGridCell) => void;
  closeContextMenu: () => void;
  closeHeaderMenu: () => void;
  onHeaderClicked: (colIndex: number) => void;
  onCellClicked: (cell: Item, event: CellClickedEventArgs) => void;
  onHeaderMenuClick: (colIndex: number) => void;
  onCellContextMenu: (cell: Item, event: CellClickedEventArgs) => void;
  handleKeyDown: (e: GridKeyEventArgs) => void;
  onAddRow: () => void;
  contextMenu: ContextMenu | null;
  getContextMenuItems: () => MenuItem[];
  getHeaderMenuItems: () => Array<{ label: string; disabled: boolean; leftSection?: React.ReactNode; group?: string }>;
  headerMenu: { x: number; y: number } | null;
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
