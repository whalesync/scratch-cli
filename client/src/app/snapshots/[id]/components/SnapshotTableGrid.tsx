'use client';

import { AnimatedArrowsClockwise } from '@/app/components/AnimatedArrowsClockwise';
import { snapshotApi } from '@/lib/api/snapshot';
import { BulkUpdateRecordsDto } from '@/types/server-entities/records';
import { ColumnSpec, Snapshot, SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import {
  CellClickedEventArgs,
  DataEditor,
  EditableGridCell,
  GridCell,
  GridCellKind,
  GridColumn,
  GridColumnMenuIcon,
  GridMouseEventArgs,
  GridSelection,
  Item,
  Theme,
} from '@glideapps/glide-data-grid';
import {
  ActionIcon,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  useModalsStack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { BugIcon, PlusIcon, SlidersIcon } from '@phosphor-icons/react';
import pluralize from 'pluralize';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnapshot, useSnapshotRecords, useSnapshotViews } from '../../../../hooks/use-snapshot';
import JsonTreeViewer from '../../../components/JsonTreeViewer';

interface SnapshotTableGridProps {
  snapshot: Snapshot;
  table: TableSpec;
  onSwitchToRecordView: (recordId: string, columnId?: string) => void;
}

type SortDirection = 'asc' | 'desc';

interface SortState {
  columnId: string;
  dir: SortDirection;
}

const generatePendingId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'ws_pending_';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const FAKE_LEFT_COLUMNS = 1;

const SnapshotTableGrid = ({ snapshot, table, onSwitchToRecordView }: SnapshotTableGridProps) => {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [sort, setSort] = useState<SortState | undefined>();
  const [hoveredRow, setHoveredRow] = useState<number | undefined>();
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    col: number;
    row: number;
  } | null>(null);
  const [headerMenu, setHeaderMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    col: number;
  } | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [activeProcess, setActiveProcess] = useState<'create-view' | 'clear-view' | undefined>();

  const [currentSelection, setCurrentSelection] = useState<GridSelection | undefined>();
  const modalStack = useModalsStack(['tableSpecDebug', 'tableContextDebug']);

  const tableContext = snapshot.tableContexts.find((c) => c.id.wsId === table.id.wsId);

  const { refreshSnapshot } = useSnapshot(snapshot.id);

  const { views, refreshViews } = useSnapshotViews({
    snapshotId: snapshot.id,
    tableId: table.id.wsId,
  });

  const activeView = views ? views.find((v) => v.id === tableContext?.activeViewId) : undefined;

  const { recordsResponse, isLoading, error, bulkUpdateRecords, acceptCellValues, rejectCellValues } = useSnapshotRecords({
    snapshotId: snapshot.id,
    tableId: table.id.wsId,
    activeView: activeView,
  });

  const sortedRecords = useMemo(() => {
    if (!recordsResponse?.records) return undefined;

    if (!sort) {
      // sort filtered last
      return recordsResponse.records.sort((a, b) => {
        if (a.filtered && !b.filtered) return 1;
        if (!a.filtered && b.filtered) return -1;
        return 0;
      });
    }

    const { columnId, dir } = sort;

    const sortedOthers = recordsResponse.records.sort((a, b) => {
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

    // resort by filtered last
    return sortedOthers.sort((a, b) => {
      if (a.filtered && !b.filtered) return 1;
      if (!a.filtered && b.filtered) return -1;
      return 0;
    });
  }, [recordsResponse?.records, sort]);

  const isActionsColumn = useCallback(
    (col: number) => {
      return col === table.columns.length + 1;
    },
    [table.columns],
  );

  const isIdColumn = useCallback((col: number) => {
    return col === 0;
  }, []);

  const onCellClicked = useCallback(
    (cell: Item, event: CellClickedEventArgs) => {
      const [col, row] = cell;
      if (isActionsColumn(col)) {
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

      if (event.isDoubleClick) {
        event.preventDefault();
        const record = sortedRecords?.[row];
        if (!record) return;
        const column = table.columns[col - FAKE_LEFT_COLUMNS];
        onSwitchToRecordView(record.id.wsId, column.id.wsId);
      }
    },
    [bulkUpdateRecords, isActionsColumn, onSwitchToRecordView, sortedRecords, table.columns],
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
      const isFiltered = record?.filtered;

      if (col === table.columns.length + 1) {
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

      if (isIdColumn(col)) {
        const themeOverride: Partial<Theme> = {};

        // Background color logic for ID column
        if (isDeleted) {
          themeOverride.bgCell = '#fde0e0';
        } else if (editedFields?.__created) {
          themeOverride.bgCell = '#e0fde0';
        }

        // Text color logic for ID column
        if (isFiltered) {
          themeOverride.textDark = '#cacaca';
        } else if (isSuggestedDeleted) {
          themeOverride.textDark = '#b8860b'; // Yellow text for suggested deletions
        }

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

      // Text color logic (independent of background)
      if (isFiltered) {
        themeOverride.textDark = '#cacaca';
      } else if (suggestedValue || isSuggestedDeleted) {
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
    [sortedRecords, table.columns, hoveredRow],
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
      debugger;
      for (const row of currentSelection.rows) {
        const record = sortedRecords?.[row];
        if (record) {
          result.records.push(record);
        }
      }
    }

    return result;
  }, [currentSelection, table.columns, sortedRecords]);

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
    console.log('onGridSelectionChange', selection);
    setCurrentSelection(selection);
  }, []);

  const onHeaderClicked = useCallback(
    (colIndex: number) => {
      if (isActionsColumn(colIndex) || isIdColumn(colIndex)) return;
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
      console.log('Header menu clicked for column:', col);

      if (isActionsColumn(col)) return;

      // Use the stored mouse position from the global mouse move handler
      const mouseX = mousePosition?.x || 0;
      const mouseY = mousePosition?.y || 0;

      console.log('Header menu position:', { mouseX, mouseY, mousePosition });

      // Show the header menu at the mouse position
      setHeaderMenu({
        visible: true,
        x: mouseX,
        y: mouseY,
        col,
      });
    },
    [table.columns, mousePosition],
  );

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  }, []);

  // Track mouse position globally
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove]);

  const onCellContextMenu = useCallback(
    (cell: Item, event: CellClickedEventArgs) => {
      const [col, row] = cell;
      console.log('Cell context menu clicked:', { col, row, event });

      // Prevent the default browser context menu
      event.preventDefault?.();

      if (isActionsColumn(col)) return;

      // Use the stored mouse position from the global mouse move handler
      const mouseX = mousePosition?.x || 0;
      const mouseY = mousePosition?.y || 0;

      console.log('Using mouse position:', { mouseX, mouseY, mousePosition });

      // Show the context menu at the mouse position
      setContextMenu({
        visible: true,
        x: mouseX,
        y: mouseY,
        col,
        row,
      });
    },
    [table.columns, sortedRecords, mousePosition],
  );

  const handleContextMenuAction = useCallback(
    async (action: string) => {
      if (!contextMenu) return;

      const { col, row } = contextMenu;
      const record = sortedRecords?.[row];
      const columnName = isIdColumn(col) ? 'ID' : table.columns[col - FAKE_LEFT_COLUMNS]?.name;
      const cellValue = isIdColumn(col)
        ? record?.id.remoteId
        : record?.fields[table.columns[col - FAKE_LEFT_COLUMNS]?.id.wsId];

      if (action === 'Accept Cell') {
        if (!record || isIdColumn(col)) return;

        const columnId = table.columns[col - FAKE_LEFT_COLUMNS]?.id.wsId;
        if (!columnId) return;

        try {
          await acceptCellValues([{ wsId: record.id.wsId, columnId }]);
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
        if (!record || isIdColumn(col)) return;

        const columnId = table.columns[col - FAKE_LEFT_COLUMNS]?.id.wsId;
        if (!columnId) return;

        try {
          await rejectCellValues([{ wsId: record.id.wsId, columnId }]);
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
        if (!record) return;

        // Get all columns that have suggestions for this record
        const suggestedValues = record.__suggested_values || {};
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
            wsId: record.id.wsId,
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
        if (!record) return;

        // Get all columns that have suggestions for this record
        const suggestedValues = record.__suggested_values || {};
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
            wsId: record.id.wsId,
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
    [contextMenu, sortedRecords, table.columns, acceptCellValues, rejectCellValues],
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
    [headerMenu, table.columns, sortedRecords, acceptCellValues, rejectCellValues],
  );

  const getContextMenuItems = useCallback(() => {
    if (!contextMenu) return [];

    const { col, row } = contextMenu;
    const record = sortedRecords?.[row];

    if (isActionsColumn(col) || isIdColumn(col)) {
      return [{ label: 'No actions', disabled: true }];
    }

    const column = table.columns[col - FAKE_LEFT_COLUMNS];
    if (!column) {
      return [{ label: 'No actions', disabled: true }];
    }

    // Check if there's a suggested value for this specific cell
    const hasCellSuggestion = !!record?.__suggested_values?.[column.id.wsId];

    // Check if there are any suggested values for any field in this record
    const recordSuggestions = record?.__suggested_values ? Object.keys(record.__suggested_values) : [];
    const hasRecordSuggestions = recordSuggestions.length > 0;

    const items = [];

    if (hasCellSuggestion) {
      items.push({ label: 'Accept Cell', disabled: false });
      items.push({ label: 'Reject Cell', disabled: false });
    }

    if (hasRecordSuggestions) {
      const suggestionCount = recordSuggestions.length;
      const suggestionText = suggestionCount === 1 ? 'suggestion' : 'suggestions';
      items.push({ label: `Accept Record (${suggestionCount} ${suggestionText})`, disabled: false });
      items.push({ label: `Reject Record (${suggestionCount} ${suggestionText})`, disabled: false });
    }

    if (items.length === 0) {
      items.push({ label: 'No actions', disabled: true });
    }

    return items;
  }, [contextMenu, sortedRecords, table.columns]);

  const getHeaderMenuItems = useCallback(() => {
    if (!headerMenu) return [];

    const { col } = headerMenu;

    if (isActionsColumn(col) || isIdColumn(col)) {
      return [{ label: 'No actions', disabled: true }];
    }

    const column = table.columns[col - FAKE_LEFT_COLUMNS];
    if (!column) {
      return [{ label: 'No actions', disabled: true }];
    }

    // Check if any record has a suggested value for this column
    const hasColumnSuggestions = sortedRecords?.some((record) => record.__suggested_values?.[column.id.wsId]);

    const items = [];

    if (hasColumnSuggestions) {
      items.push({ label: 'Accept Column', disabled: false });
      items.push({ label: 'Reject Column', disabled: false });
    }

    if (items.length === 0) {
      items.push({ label: 'No actions', disabled: true });
    }

    return items;
  }, [headerMenu, sortedRecords, table.columns]);

  const columns: GridColumn[] = useMemo(() => {
    const baseColumns: GridColumn[] = table.columns.map(
      (c) =>
        ({
          title: titleWithSort(c, sort),
          id: c.id.wsId,
          width: columnWidths[c.id.wsId] ?? 150,
          menuIcon: GridColumnMenuIcon.Dots,
          icon: 'headerMenu',
          hasMenu: true,
          ...(c.readonly && {
            themeOverride: {
              bgCell: '#F7F7F7',
            },
          }),
        }) satisfies GridColumn,
    );

    const result = [
      {
        title: 'ID',
        id: 'id',
        width: 150,
        themeOverride: { bgCell: '#F7F7F7' },
        menuIcon: GridColumnMenuIcon.Dots,
        icon: 'headerMenu',
        hasMenu: true,
      },
      ...baseColumns,
      {
        id: 'actions',
        title: '',
        width: 35,
        // No menu icon for actions column
      },
    ];

    console.log('Columns created:', result);
    return result;
  }, [table.columns, sort, columnWidths]);

  if (error) {
    return (
      <Center h="100%">
        <Text c="red">Error loading records: {error.message}</Text>
      </Center>
    );
  }

  if (isLoading && !recordsResponse) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <Modal {...modalStack.register('tableSpecDebug')} title={`TableSpec for ${table.name}`} size="lg">
        <ScrollArea h={500}>
          <JsonTreeViewer jsonData={table} />
        </ScrollArea>
      </Modal>
      <Modal {...modalStack.register('tableContextDebug')} title={`Table Context settings for ${table.name}`} size="lg">
        <ScrollArea h={500}>
          <JsonTreeViewer jsonData={tableContext ?? {}} />
        </ScrollArea>
      </Modal>
      <Box
        h="100%"
        w="100%"
        style={{ position: 'relative' }}
        onClick={() => {
          closeContextMenu();
          closeHeaderMenu();
        }}
      >
        <Stack p={0} h="100%" gap={0}>
          <DataEditor
            width="100%"
            height="100%"
            columns={columns}
            rows={sortedRecords?.length ?? 0}
            gridSelection={currentSelection}
            getCellContent={getCellContent}
            onCellEdited={onCellEdited}
            onColumnResize={onColumnResize}
            onHeaderClicked={onHeaderClicked}
            onCellClicked={onCellClicked}
            getCellsForSelection={true}
            onGridSelectionChange={onGridSelectionChange}
            onPaste={true}
            onItemHovered={(args: GridMouseEventArgs) => {
              if (args.kind === 'cell') {
                setHoveredRow(args.location[1]);
              } else {
                setHoveredRow(undefined);
              }
            }}
            rowMarkers="both"
            onHeaderMenuClick={onHeaderMenuClick}
            onCellContextMenu={onCellContextMenu}
            theme={{
              headerIconSize: 24,
              bgHeader: '#f8f9fa',
              textHeader: '#333',
            }}
          />
          <Group w="100%" p="xs" bg="gray.0">
            {isLoading ? (
              <AnimatedArrowsClockwise size={24} />
            ) : currentSelection && getSelectedRowCount(currentSelection) > 0 ? (
              <Text size="sm" fs="italic">
                {getSelectedRowCount(currentSelection)} {pluralize('record', getSelectedRowCount(currentSelection))}{' '}
                selected
              </Text>
            ) : (
              <Text size="sm">
                {sortedRecords?.length ?? 0} {pluralize('record', sortedRecords?.length ?? 0)}
              </Text>
            )}

            <Tooltip label="Select one or more records to create a view">
              <Button
                variant="outline"
                loading={activeProcess === 'create-view'}
                disabled={getSelectedRowCount(currentSelection) === 0}
                onClick={async () => {
                  const { records } = getGetSelectedRecordsAndColumns();
                  try {
                    setActiveProcess('create-view');
                    await snapshotApi.activateView(snapshot.id, table.id.wsId, {
                      name: 'Selected Records',
                      source: 'ui',
                      recordIds: records.map((r) => r.id.wsId),
                    });
                    await refreshViews();
                    setCurrentSelection(undefined);
                  } catch (e) {
                    const error = e as Error;
                    notifications.show({
                      title: 'Error activating view',
                      message: error.message,
                      color: 'red',
                    });
                  } finally {
                    setActiveProcess(undefined);
                  }
                }}
              >
                Create view
              </Button>
            </Tooltip>

            <Button
              variant="outline"
              disabled={!activeView}
              loading={activeProcess === 'clear-view'}
              onClick={async () => {
                try {
                  setActiveProcess('clear-view');
                  await snapshotApi.clearActiveView(snapshot.id, table.id.wsId);
                  await refreshViews();
                  await refreshSnapshot();
                } catch (e) {
                  const error = e as Error;
                  notifications.show({
                    title: 'Error clearing view',
                    message: error.message,
                    color: 'red',
                  });
                } finally {
                  setActiveProcess(undefined);
                }
              }}
            >
              Clear view
            </Button>

            <Group gap="xs" ml="auto" p={0}>
              <Tooltip label="View JSON data">
                <ActionIcon
                  onClick={() => modalStack.open('tableSpecDebug')}
                  size="lg"
                  radius="xl"
                  variant="filled"
                  color="violet"
                >
                  <BugIcon size={24} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="View Table Context data">
                <ActionIcon
                  onClick={() => modalStack.open('tableContextDebug')}
                  size="lg"
                  radius="xl"
                  variant="filled"
                  color="gray"
                >
                  <SlidersIcon size={24} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Add record">
                <ActionIcon onClick={onAddRow} size="lg" radius="xl" variant="filled">
                  <PlusIcon size={24} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Stack>
      </Box>

      {/* Context Menu */}
      {contextMenu && (
        <Menu
          opened={contextMenu.visible}
          onClose={closeContextMenu}
          position="bottom-start"
          offset={0}
          styles={{
            dropdown: {
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 1000,
            },
          }}
        >
          <Menu.Target>
            <div
              style={{
                position: 'fixed',
                left: contextMenu.x,
                top: contextMenu.y,
                width: 1,
                height: 1,
                pointerEvents: 'none',
              }}
            />
          </Menu.Target>

          <Menu.Dropdown>
            {getContextMenuItems().map((item, index) => (
              <Menu.Item
                key={index}
                disabled={item.disabled}
                onClick={item.disabled ? undefined : () => handleContextMenuAction(item.label)}
              >
                {item.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}

      {/* Header Menu */}
      {headerMenu && (
        <Menu
          opened={headerMenu.visible}
          onClose={closeHeaderMenu}
          position="bottom-start"
          offset={0}
          styles={{
            dropdown: {
              position: 'fixed',
              left: headerMenu.x,
              top: headerMenu.y,
              zIndex: 1000,
            },
          }}
        >
          <Menu.Target>
            <div
              style={{
                position: 'fixed',
                left: headerMenu.x,
                top: headerMenu.y,
                width: 1,
                height: 1,
                pointerEvents: 'none',
              }}
            />
          </Menu.Target>

          <Menu.Dropdown>
            {getHeaderMenuItems().map((item, index) => (
              <Menu.Item
                key={index}
                disabled={item.disabled}
                onClick={item.disabled ? undefined : () => handleHeaderMenuAction(item.label)}
              >
                {item.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
    </>
  );
};

function titleWithSort(column: ColumnSpec, sort: SortState | undefined) {
  if (sort?.columnId !== column.id.wsId) {
    return column.name;
  }
  const icon = sort.dir === 'asc' ? '🔼' : '🔽';
  return `${column.name} ${icon}`;
}

function getSelectedRowCount(currentSelection: GridSelection | undefined) {
  if (!currentSelection) return 0;

  if (currentSelection.current) {
    return currentSelection.current.range.height;
  }

  if (currentSelection.rows) {
    return currentSelection.rows.length;
  }

  return 0;
}

export default SnapshotTableGrid;
