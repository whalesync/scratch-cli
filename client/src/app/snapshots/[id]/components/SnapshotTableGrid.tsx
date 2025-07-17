'use client';

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
  GridColumnIcon,
  GridColumnMenuIcon,
  GridKeyEventArgs,
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
import {
  BugIcon,
  CheckIcon,
  Eye,
  EyeSlash,
  ListBulletsIcon,
  ListChecksIcon,
  Pencil,
  PencilSlash,
  PlusIcon,
  SlidersIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnapshotRecords } from '../../../../hooks/use-snapshot';
import { useUpsertView, useViews } from '../../../../hooks/use-view';
import JsonTreeViewer from '../../../components/JsonTreeViewer';

interface SnapshotTableGridProps {
  snapshot: Snapshot;
  table: TableSpec;
  currentViewId?: string | null;
  onSwitchToRecordView: (recordId: string, columnId?: string) => void;
  onViewCreated?: (viewId: string) => void;
  onFocusedCellsChange?: (readFocus: FocusedCell[], writeFocus: FocusedCell[]) => void;
  filterToView: boolean;
  onFilteredRecordsCountChange?: (count: number) => void;
}

type SortDirection = 'asc' | 'desc';

interface SortState {
  columnId: string;
  dir: SortDirection;
}

interface FocusedCell {
  recordWsId: string;
  columnWsId: string;
}

const generatePendingId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'ws_pending_';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Helper function to get column type icon
const getColumnIcon = (column: ColumnSpec): GridColumnIcon => {
  switch (column.pgType) {
    case 'text':
      return GridColumnIcon.HeaderString;
    case 'text[]':
      return GridColumnIcon.HeaderArray;
    case 'numeric':
      return GridColumnIcon.HeaderNumber;
    case 'numeric[]':
      return GridColumnIcon.HeaderArray;
    case 'boolean':
      return GridColumnIcon.HeaderBoolean;
    case 'boolean[]':
      return GridColumnIcon.HeaderArray;
    case 'jsonb':
      return GridColumnIcon.HeaderCode;
    default:
      return GridColumnIcon.HeaderString;
  }
};

const FAKE_LEFT_COLUMNS = 2; // Updated to account for the new record status column

const FOCUS_GROUP_NAME = 'Set/Unset Focus';
const FILTERING_GROUP_NAME = 'Filtering';
const COLUMN_VIEW_GROUP_NAME = 'Column View';
const ACCEPT_REJECT_GROUP_NAME = 'Accept/Reject Changes';
const MENU_ICON_SIZE = 18;

const SnapshotTableGrid = ({
  snapshot,
  table,
  currentViewId,
  onSwitchToRecordView,
  onViewCreated,
  onFocusedCellsChange,
  filterToView,
  onFilteredRecordsCountChange,
}: SnapshotTableGridProps) => {
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

  const [currentSelection, setCurrentSelection] = useState<GridSelection | undefined>();
  const [readFocus, setReadFocus] = useState<FocusedCell[]>([]);
  const [writeFocus, setWriteFocus] = useState<FocusedCell[]>([]);
  const modalStack = useModalsStack(['tableSpecDebug', 'tableContextDebug', 'focusedCellsDebug']);

  const tableContext = snapshot.tableContexts.find((c) => c.id.wsId === table.id.wsId);

  const { views, refreshViews } = useViews(snapshot.id);

  const activeView = views ? views.find((v) => v.id === currentViewId) : undefined;

  const {
    recordsResponse,
    isLoading,
    error,
    bulkUpdateRecords,
    acceptCellValues,
    rejectCellValues,
    filteredRecordsCount,
    refreshRecords,
  } = useSnapshotRecords({
    snapshotId: snapshot.id,
    tableId: table.id.wsId,
    viewId: filterToView && activeView ? activeView.id : undefined,
  });

  const { upsertView } = useUpsertView();

  // Notify parent component when focused cells change
  useEffect(() => {
    if (onFocusedCellsChange) {
      onFocusedCellsChange(readFocus, writeFocus);
    }
  }, [readFocus, writeFocus, onFocusedCellsChange]);

  // Notify parent component when filtered records count changes
  useEffect(() => {
    if (onFilteredRecordsCountChange) {
      onFilteredRecordsCountChange(filteredRecordsCount);
    }
  }, [filteredRecordsCount, onFilteredRecordsCountChange]);

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
      return col === table.columns.length + 2;
    },
    [table.columns],
  );

  const isIdColumn = (col: number) => {
    return col === 1; // Updated to account for the new record status column
  };

  const isRecordStatusColumn = (col: number) => {
    return col === 0; // New column for record status icons
  };

  const getColumnStatus = useCallback(
    (columnId: string) => {
      if (!activeView || !activeView.config[table.id.wsId]) {
        return { hidden: false, protected: false }; // Default to not hidden and not protected if not in view
      }

      const tableConfig = activeView.config[table.id.wsId];
      const columnConfig = tableConfig.columns?.find((c: { wsId: string }) => c.wsId === columnId);

      if (!columnConfig) {
        return { hidden: false, protected: false }; // Default to not hidden and not protected if not specified
      }

      return {
        hidden: columnConfig.hidden === true, // Default to false if not set
        protected: columnConfig.protected === true, // Default to false if not set
      };
    },
    [activeView, table.id.wsId],
  );

  // const getRecordStatus = useCallback(
  //   (recordId: string) => {
  //     if (!activeView || !activeView.config[table.id.wsId]) {
  //       return { visible: true, editable: true }; // Default to visible and editable if not in view
  //     }

  //     const tableConfig = activeView.config[table.id.wsId];
  //     const recordConfig = tableConfig.records?.find((r: { wsId: string }) => r.wsId === recordId);

  //     if (!recordConfig) {
  //       return { visible: true, editable: true }; // Default to visible and editable if not specified
  //     }

  //     return {
  //       visible: recordConfig.visible !== false, // Default to true if not set
  //       editable: recordConfig.editable !== false, // Default to true if not set
  //     };
  //   },
  //   [activeView, table.id.wsId],
  // );
  const getRecordStatus = useCallback(() => {
    // TODO: records field moved to different entity - temporarily return defaults
    return { visible: true, editable: true }; // Default to visible and editable for now
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
        console.log('Focused cell detected:', {
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
        // if (activeView && activeView.config[table.id.wsId]) {
        //   const tableConfig = activeView.config[table.id.wsId];
        //   const recordConfig = tableConfig.records?.find((r: { wsId: string }) => r.wsId === record.id.wsId);

        //   if (recordConfig) {
        //     // Record is in the config, show icons only for explicitly overridden properties
        //     let icons = '';

        //     // Only show visibility icon if explicitly set
        //     if ('visible' in recordConfig) {
        //       const visibilityIcon = recordConfig.visible ? '👁️' : '🚫';
        //       icons += visibilityIcon;
        //     }

        //     // Only show editability icon if explicitly set
        //     if ('editable' in recordConfig) {
        //       const editabilityIcon = recordConfig.editable ? '✏️' : '🔒';
        //       icons += editabilityIcon;
        //     }

        //     displayText = icons;
        //   }
        //   // If record is not in config, don't show any icons
        // }

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
    [sortedRecords, table.columns, hoveredRow, activeView, readFocus],
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
      if (isActionsColumn(colIndex) || isIdColumn(colIndex) || isRecordStatusColumn(colIndex)) return;
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
    [table.columns, isActionsColumn, isRecordStatusColumn],
  );

  const onColumnResize = useCallback((column: GridColumn, newSize: number) => {
    if (column.id && column.id !== 'actions') {
      setColumnWidths((prev) => ({ ...prev, [column.id as string]: newSize }));
    }
  }, []);

  const onHeaderMenuClick = useCallback(
    (col: number) => {
      console.log('Header menu clicked for column:', col);

      if (isActionsColumn(col) || isRecordStatusColumn(col) || isIdColumn(col)) return;

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
    [mousePosition, isActionsColumn, isRecordStatusColumn, isIdColumn],
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

          setReadFocus((prev) => {
            const newReadFocus = [...prev];

            records.forEach((record) => {
              columns.forEach((column) => {
                const cellKey = `${record.id.wsId}-${column.id.wsId}`;
                const existingIndex = newReadFocus.findIndex((fc) => `${fc.recordWsId}-${fc.columnWsId}` === cellKey);

                if (existingIndex >= 0) {
                  // Remove if already focused
                  newReadFocus.splice(existingIndex, 1);
                  removedCount++;
                } else {
                  // Add if not focused
                  newReadFocus.push({
                    recordWsId: record.id.wsId,
                    columnWsId: column.id.wsId,
                  });
                  addedCount++;
                }
              });
            });

            return newReadFocus;
          });

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

          setWriteFocus((prev) => {
            const newWriteFocus = [...prev];

            records.forEach((record) => {
              columns.forEach((column) => {
                const cellKey = `${record.id.wsId}-${column.id.wsId}`;
                const existingIndex = newWriteFocus.findIndex((fc) => `${fc.recordWsId}-${fc.columnWsId}` === cellKey);

                if (existingIndex >= 0) {
                  // Remove if already focused
                  newWriteFocus.splice(existingIndex, 1);
                  removedCount++;
                } else {
                  // Add if not focused
                  newWriteFocus.push({
                    recordWsId: record.id.wsId,
                    columnWsId: column.id.wsId,
                  });
                  addedCount++;
                }
              });
            });

            return newWriteFocus;
          });

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
      } else if (e.key.toLowerCase() === 'c' && e.shiftKey && (readFocus.length > 0 || writeFocus.length > 0)) {
        e.preventDefault();
        e.stopPropagation();

        // Clear both focus sets when 'Shift+C' is pressed
        const totalCleared = readFocus.length + writeFocus.length;
        setReadFocus([]);
        setWriteFocus([]);
        notifications.show({
          title: 'All Focus Cleared',
          message: `Cleared ${totalCleared} focused cell(s)`,
          color: 'blue',
        });
      }
    },
    [currentSelection, getGetSelectedRecordsAndColumns, readFocus, writeFocus],
  );

  const onCellContextMenu = useCallback(
    (cell: Item, event: CellClickedEventArgs) => {
      const [col, row] = cell;
      console.log('Cell context menu clicked:', { col, row, event });

      // Prevent the default browser context menu
      event.preventDefault?.();

      if (isActionsColumn(col) || isRecordStatusColumn(col) || isIdColumn(col)) return;

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
    [mousePosition, isActionsColumn, isRecordStatusColumn, isIdColumn],
  );

  const handleContextMenuAction = useCallback(
    async (action: string) => {
      if (!contextMenu) return;
      const { col, row } = contextMenu;
      const record = sortedRecords?.[row];
      const column = table.columns[col - FAKE_LEFT_COLUMNS];
      if (!record || !column) return;

      if (action === 'Add Read Focus') {
        // Add all selected cells to readFocus (avoid duplicates)
        if (!currentSelection) return;
        const newCells: FocusedCell[] = [];
        if (currentSelection.current) {
          const { range } = currentSelection.current;
          for (let r = range.y; r < range.y + range.height; r++) {
            for (let c = range.x; c < range.x + range.width; c++) {
              if (isActionsColumn(c) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
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
        setReadFocus((prev) => [...prev, ...newCells]);
        notifications.show({
          title: 'Read Focus Added',
          message: `Added ${newCells.length} cell(s) to read focus`,
          color: 'blue',
        });
        setContextMenu(null);
        return;
      }

      if (action === 'Add Write Focus') {
        // Add all selected cells to writeFocus (avoid duplicates)
        if (!currentSelection) return;
        const newCells: FocusedCell[] = [];
        if (currentSelection.current) {
          const { range } = currentSelection.current;
          for (let r = range.y; r < range.y + range.height; r++) {
            for (let c = range.x; c < range.x + range.width; c++) {
              if (isActionsColumn(c) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
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
        setWriteFocus((prev) => [...prev, ...newCells]);
        notifications.show({
          title: 'Write Focus Added',
          message: `Added ${newCells.length} cell(s) to write focus`,
          color: 'orange',
        });
        setContextMenu(null);
        return;
      }

      if (action === 'Remove Read Focus') {
        // Remove selected cells from readFocus
        if (!currentSelection) return;
        const cellsToRemove: FocusedCell[] = [];
        if (currentSelection.current) {
          const { range } = currentSelection.current;
          for (let r = range.y; r < range.y + range.height; r++) {
            for (let c = range.x; c < range.x + range.width; c++) {
              if (isActionsColumn(c) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
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
        setReadFocus((prev) =>
          prev.filter(
            (f) => !cellsToRemove.some((c) => c.recordWsId === f.recordWsId && c.columnWsId === f.columnWsId),
          ),
        );
        notifications.show({
          title: 'Read Focus Removed',
          message: `Removed ${cellsToRemove.length} cell(s) from read focus`,
          color: 'blue',
        });
        setContextMenu(null);
        return;
      }

      if (action === 'Remove Write Focus') {
        // Remove selected cells from writeFocus
        if (!currentSelection) return;
        const cellsToRemove: FocusedCell[] = [];
        if (currentSelection.current) {
          const { range } = currentSelection.current;
          for (let r = range.y; r < range.y + range.height; r++) {
            for (let c = range.x; c < range.x + range.width; c++) {
              if (isActionsColumn(c) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
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
        setWriteFocus((prev) =>
          prev.filter(
            (f) => !cellsToRemove.some((c) => c.recordWsId === f.recordWsId && c.columnWsId === f.columnWsId),
          ),
        );
        notifications.show({
          title: 'Write Focus Removed',
          message: `Removed ${cellsToRemove.length} cell(s) from write focus`,
          color: 'orange',
        });
        setContextMenu(null);
        return;
      }

      if (action === 'Filter Out Records') {
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
        return;
      }

      if (isActionsColumn(col) || isIdColumn(col) || isRecordStatusColumn(col)) {
        return;
      }

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
    [
      contextMenu,
      sortedRecords,
      table.columns,
      acceptCellValues,
      rejectCellValues,
      upsertView,
      refreshViews,
      snapshot.id,
      table.id.wsId,
      currentViewId,
      activeView,
      onViewCreated,
      currentSelection,
      readFocus,
      setReadFocus,
      notifications,
      writeFocus,
      setWriteFocus,
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
            onViewCreated?.(result.id);
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
      onViewCreated,
    ],
  );

  const getContextMenuItems = useCallback(() => {
    if (!contextMenu) return [];

    const { col, row } = contextMenu;
    const record = sortedRecords?.[row];

    if (isActionsColumn(col) || isIdColumn(col) || isRecordStatusColumn(col)) {
      return [{ label: 'No actions', disabled: true }];
    }

    const column = table.columns[col - FAKE_LEFT_COLUMNS];
    if (!column) {
      return [{ label: 'No actions', disabled: true }];
    }

    // Check if any selected cells are not in read focus
    const hasUnfocusedReadCells =
      currentSelection?.current &&
      (() => {
        const { range } = currentSelection.current;
        for (let r = range.y; r < range.y + range.height; r++) {
          for (let c = range.x; c < range.x + range.width; c++) {
            if (isActionsColumn(c) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
            const rec = sortedRecords?.[r];
            const colObj = table.columns[c - FAKE_LEFT_COLUMNS];
            if (rec && colObj) {
              const cell: FocusedCell = { recordWsId: rec.id.wsId, columnWsId: colObj.id.wsId };
              if (!readFocus.some((f) => f.recordWsId === cell.recordWsId && f.columnWsId === cell.columnWsId)) {
                return true;
              }
            }
          }
        }
        return false;
      })();

    // Check if any selected cells are in read focus
    const hasFocusedReadCells =
      currentSelection?.current &&
      (() => {
        const { range } = currentSelection.current;
        for (let r = range.y; r < range.y + range.height; r++) {
          for (let c = range.x; c < range.x + range.width; c++) {
            if (isActionsColumn(c) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
            const rec = sortedRecords?.[r];
            const colObj = table.columns[c - FAKE_LEFT_COLUMNS];
            if (rec && colObj) {
              const cell: FocusedCell = { recordWsId: rec.id.wsId, columnWsId: colObj.id.wsId };
              if (readFocus.some((f) => f.recordWsId === cell.recordWsId && f.columnWsId === cell.columnWsId)) {
                return true;
              }
            }
          }
        }
        return false;
      })();

    // Check if any selected cells are not in write focus
    const hasUnfocusedWriteCells =
      currentSelection?.current &&
      (() => {
        const { range } = currentSelection.current;
        for (let r = range.y; r < range.y + range.height; r++) {
          for (let c = range.x; c < range.x + range.width; c++) {
            if (isActionsColumn(c) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
            const rec = sortedRecords?.[r];
            const colObj = table.columns[c - FAKE_LEFT_COLUMNS];
            if (rec && colObj) {
              const cell: FocusedCell = { recordWsId: rec.id.wsId, columnWsId: colObj.id.wsId };
              if (!writeFocus.some((f) => f.recordWsId === cell.recordWsId && f.columnWsId === cell.columnWsId)) {
                return true;
              }
            }
          }
        }
        return false;
      })();

    // Check if any selected cells are in write focus
    const hasFocusedWriteCells =
      currentSelection?.current &&
      (() => {
        const { range } = currentSelection.current;
        for (let r = range.y; r < range.y + range.height; r++) {
          for (let c = range.x; c < range.x + range.width; c++) {
            if (isActionsColumn(c) || isIdColumn(c) || isRecordStatusColumn(c)) continue;
            const rec = sortedRecords?.[r];
            const colObj = table.columns[c - FAKE_LEFT_COLUMNS];
            if (rec && colObj) {
              const cell: FocusedCell = { recordWsId: rec.id.wsId, columnWsId: colObj.id.wsId };
              if (writeFocus.some((f) => f.recordWsId === cell.recordWsId && f.columnWsId === cell.columnWsId)) {
                return true;
              }
            }
          }
        }
        return false;
      })();

    // Conditionally show add/remove items
    const focusItems: Array<{ label: string; disabled: boolean; leftSection?: React.ReactNode; group?: string }> = [];
    if (hasUnfocusedReadCells) {
      focusItems.push({
        label: 'Add Read Focus',
        disabled: false,
        leftSection: <Eye size={MENU_ICON_SIZE} color="#0066cc" />,
        group: FOCUS_GROUP_NAME,
      });
    }
    if (hasFocusedReadCells) {
      focusItems.push({
        label: 'Remove Read Focus',
        disabled: false,
        leftSection: <EyeSlash size={MENU_ICON_SIZE} />,
        group: FOCUS_GROUP_NAME,
      });
    }
    if (hasUnfocusedWriteCells) {
      focusItems.push({
        label: 'Add Write Focus',
        disabled: false,
        leftSection: <Pencil size={MENU_ICON_SIZE} color="#ff8c00" />,
        group: FOCUS_GROUP_NAME,
      });
    }
    if (hasFocusedWriteCells) {
      focusItems.push({
        label: 'Remove Write Focus',
        disabled: false,
        leftSection: <PencilSlash size={MENU_ICON_SIZE} />,
        group: FOCUS_GROUP_NAME,
      });
    }

    const items = focusItems;

    // Add Filter Out Records item if records are selected
    if (currentSelection && getSelectedRowCount(currentSelection) > 0) {
      items.push({
        label: 'Filter Out Records',
        disabled: false,
        group: FILTERING_GROUP_NAME,
        leftSection: '🚫',
      });
    }

    // Check if there's a suggested value for this specific cell
    const hasCellSuggestion = !!record?.__suggested_values?.[column.id.wsId];

    // Check if there are any suggested values for any field in this record
    const recordSuggestions = record?.__suggested_values ? Object.keys(record.__suggested_values) : [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const hasRecordSuggestions = recordSuggestions.length > 0;

    if (items.length === 0) {
      items.push({ label: 'No actions', disabled: true });
    }

    return items.concat(
      [
        ...(() => {
          const extraItems = [];
          if (hasCellSuggestion) {
            extraItems.push({
              label: 'Accept Cell',
              disabled: false,
              group: ACCEPT_REJECT_GROUP_NAME,
              leftSection: <CheckIcon size={MENU_ICON_SIZE} color="#00aa00" />,
            });
            extraItems.push({
              label: 'Reject Cell',
              disabled: false,
              group: ACCEPT_REJECT_GROUP_NAME,
              leftSection: <XIcon size={MENU_ICON_SIZE} color="#ff0000" />,
            });
          }
          const recordSuggestions = record?.__suggested_values ? Object.keys(record.__suggested_values) : [];
          const hasRecordSuggestions = recordSuggestions.length > 0;
          if (hasRecordSuggestions) {
            const suggestionCount = recordSuggestions.length;
            const suggestionText = suggestionCount === 1 ? 'suggestion' : 'suggestions';
            extraItems.push({
              label: `Accept Record (${suggestionCount} ${suggestionText})`,
              disabled: false,
              group: ACCEPT_REJECT_GROUP_NAME,
              leftSection: <ListChecksIcon size={MENU_ICON_SIZE} color="#00aa00" />,
            });
            extraItems.push({
              label: `Reject Record (${suggestionCount} ${suggestionText})`,
              disabled: false,
              group: ACCEPT_REJECT_GROUP_NAME,
              leftSection: <ListBulletsIcon size={MENU_ICON_SIZE} color="#ff0000" />,
            });
          }
          // TODO: records field moved to different entity - temporarily disable record actions
          // const tableConfig = activeView?.config[table.id.wsId];
          // const tableDefaults = {
          //   visible: tableConfig?.visible !== false,
          //   editable: tableConfig?.editable !== false,
          // };
          // const recordConfig = tableConfig?.records?.find((r: { wsId: string }) => r.wsId === record?.id.wsId);
          // const hasRecordVisibleOverride = recordConfig && recordConfig.visible !== undefined;
          // const hasRecordEditableOverride = recordConfig && recordConfig.editable !== undefined;
          // if (hasRecordVisibleOverride) {
          //   extraItems.push({ label: 'Unset Record Visibility', disabled: false, group: FILTERING_GROUP_NAME });
          // } else {
          //   extraItems.push({
          //     label: `Make Record ${tableDefaults.visible ? 'Hidden' : 'Visible'}`,
          //     disabled: false,
          //     group: FILTERING_GROUP_NAME,
          //   });
          // }
          // if (hasRecordEditableOverride) {
          //   extraItems.push({ label: 'Unset Record Editability', disabled: false, group: FILTERING_GROUP_NAME });
          // } else {
          //   extraItems.push({
          //     label: `Make Record ${tableDefaults.editable ? 'Locked' : 'Editable'}`,
          //     disabled: false,
          //     group: FILTERING_GROUP_NAME,
          //   });
          // }
          return extraItems;
        })(),
      ].flat(),
    );
  }, [contextMenu, sortedRecords, table.columns, isActionsColumn, isRecordStatusColumn, activeView, table.id.wsId]);

  const getHeaderMenuItems = useCallback((): Array<{
    label: string;
    disabled: boolean;
    leftSection?: React.ReactNode;
    group?: string;
  }> => {
    if (!headerMenu) return [];

    const { col } = headerMenu;

    if (isActionsColumn(col) || isIdColumn(col) || isRecordStatusColumn(col)) {
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
        leftSection: '🚫',
      });
    }
    // Protect/Unprotect
    if (hasColumnProtectedOverride) {
      items.push({
        label: 'Unprotect Column',
        disabled: false,
        group: COLUMN_VIEW_GROUP_NAME,
        leftSection: '✏️',
      });
    } else {
      items.push({
        label: 'Protect Column',
        disabled: false,
        group: COLUMN_VIEW_GROUP_NAME,
        leftSection: '🔒',
      });
    }

    if (items.length === 0) {
      items.push({ label: 'No actions', disabled: true });
    }

    return items;
  }, [headerMenu, sortedRecords, table.columns, isActionsColumn, isRecordStatusColumn, activeView, table.id.wsId]);

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
            const hiddenIcon = columnConfig.hidden ? '🚫' : '👁️';
            icons += hiddenIcon;
          }

          // Only show protected icon if explicitly set
          if ('protected' in columnConfig) {
            const protectedIcon = columnConfig.protected ? '🔒' : '✏️';
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

    console.log('Columns created:', result);
    return result;
  }, [table.columns, sort, columnWidths, getColumnStatus, activeView, getRecordStatus, currentViewId]);

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
      <Modal
        {...modalStack.register('focusedCellsDebug')}
        title={`Focused Cells Debug (${readFocus.length + writeFocus.length})`}
        size="lg"
      >
        <ScrollArea h={500}>
          <Stack gap="md">
            <Text size="sm" fw={500}>
              Read Focus Details ({readFocus.length}):
            </Text>
            {readFocus.length === 0 ? (
              <Text size="sm" c="dimmed">
                No read focused cells
              </Text>
            ) : (
              <Stack gap="xs">
                {readFocus.map((cell, index) => (
                  <Box
                    key={`read-${cell.recordWsId}-${cell.columnWsId}`}
                    p="xs"
                    bg="blue.0"
                    style={{ borderRadius: 4, borderLeft: '4px solid #0066cc' }}
                  >
                    <Text size="sm">
                      <strong>Read Cell {index + 1}:</strong> Record ID: {cell.recordWsId}, Column ID: {cell.columnWsId}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Column Name: {table.columns.find((c) => c.id.wsId === cell.columnWsId)?.name || 'Unknown'}
                    </Text>
                  </Box>
                ))}
              </Stack>
            )}

            <Text size="sm" fw={500}>
              Write Focus Details ({writeFocus.length}):
            </Text>
            {writeFocus.length === 0 ? (
              <Text size="sm" c="dimmed">
                No write focused cells
              </Text>
            ) : (
              <Stack gap="xs">
                {writeFocus.map((cell, index) => (
                  <Box
                    key={`write-${cell.recordWsId}-${cell.columnWsId}`}
                    p="xs"
                    bg="orange.0"
                    style={{ borderRadius: 4, borderLeft: '4px solid #ff8c00' }}
                  >
                    <Text size="sm">
                      <strong>Write Cell {index + 1}:</strong> Record ID: {cell.recordWsId}, Column ID:{' '}
                      {cell.columnWsId}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Column Name: {table.columns.find((c) => c.id.wsId === cell.columnWsId)?.name || 'Unknown'}
                    </Text>
                  </Box>
                ))}
              </Stack>
            )}

            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                console.log('Read Focus:', readFocus);
                console.log('Write Focus:', writeFocus);
                console.log('Sorted Records:', sortedRecords);
              }}
            >
              Log to Console
            </Button>
          </Stack>
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
            onKeyDown={handleKeyDown}
            theme={{
              headerIconSize: 24,
              bgHeader: '#f8f9fa',
              textHeader: '#333',
            }}
            drawCell={(args, defaultDraw) => {
              const { rect, ctx, col, row } = args;

              // Let the default renderer draw the text cell first
              defaultDraw();

              // Check if this cell is in read focus
              const record = sortedRecords?.[row];
              const isReadFocused =
                record &&
                readFocus.some(
                  (focusedCell) =>
                    focusedCell.recordWsId === record.id.wsId &&
                    focusedCell.columnWsId === (col === 1 ? 'id' : table.columns[col - FAKE_LEFT_COLUMNS]?.id.wsId),
                );

              // Check if this cell is in write focus
              const isWriteFocused =
                record &&
                writeFocus.some(
                  (focusedCell) =>
                    focusedCell.recordWsId === record.id.wsId &&
                    focusedCell.columnWsId === (col === 1 ? 'id' : table.columns[col - FAKE_LEFT_COLUMNS]?.id.wsId),
                );

              // Add custom border for focused cells
              // Draw write focus first (thicker border, underneath)
              if (isWriteFocused) {
                ctx.strokeStyle = '#ff8c00'; // Orange for write focus
                ctx.lineWidth = 4; // Thicker border for write focus
                ctx.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
              }

              // Draw read focus on top (thinner border, on top)
              if (isReadFocused) {
                ctx.strokeStyle = '#0066cc'; // Blue for read focus
                ctx.lineWidth = 2; // Thinner border for read focus
                ctx.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
              }
            }}
            data-grid-container // Add this attribute to the grid container
          />
          <Group w="100%" p="xs" bg="gray.0" justify="flex-end">
            <Group gap="xs" p={0}>
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
            {getContextMenuItems().map((item, index) => {
              // Check if this is a focus item using the group property
              const isFocusItem = item.group === FOCUS_GROUP_NAME;
              const isFilteringItem = item.group === FILTERING_GROUP_NAME;
              const isAcceptRejectItem = item.group === ACCEPT_REJECT_GROUP_NAME;

              // If this is the first focus item, add the Focus section header
              if (isFocusItem && index === getContextMenuItems().findIndex((i) => i.group === FOCUS_GROUP_NAME)) {
                return (
                  <div key={`focus-section-${index}`}>
                    <Menu.Divider />
                    <Menu.Label>{FOCUS_GROUP_NAME}</Menu.Label>
                    <Menu.Item
                      disabled={item.disabled}
                      leftSection={item.leftSection}
                      onClick={item.disabled ? undefined : () => handleContextMenuAction(item.label)}
                    >
                      {item.label}
                    </Menu.Item>
                  </div>
                );
              }

              // If this is a focus item but not the first one, render normally
              if (isFocusItem) {
                return (
                  <Menu.Item
                    key={index}
                    disabled={item.disabled}
                    leftSection={item.leftSection}
                    onClick={item.disabled ? undefined : () => handleContextMenuAction(item.label)}
                  >
                    {item.label}
                  </Menu.Item>
                );
              }

              // If this is the first filtering item, add the Filtering section header
              if (
                isFilteringItem &&
                index === getContextMenuItems().findIndex((i) => i.group === FILTERING_GROUP_NAME)
              ) {
                return (
                  <div key={`filtering-section-${index}`}>
                    <Menu.Divider />
                    <Menu.Label>{FILTERING_GROUP_NAME}</Menu.Label>
                    <Menu.Item
                      disabled={item.disabled}
                      leftSection={item.leftSection}
                      onClick={item.disabled ? undefined : () => handleContextMenuAction(item.label)}
                    >
                      {item.label}
                    </Menu.Item>
                  </div>
                );
              }

              // If this is a filtering item but not the first one, render normally
              if (isFilteringItem) {
                return (
                  <Menu.Item
                    key={index}
                    disabled={item.disabled}
                    leftSection={item.leftSection}
                    onClick={item.disabled ? undefined : () => handleContextMenuAction(item.label)}
                  >
                    {item.label}
                  </Menu.Item>
                );
              }

              // If this is the first accept/reject item, add the Accept/Reject Changes section header
              if (
                isAcceptRejectItem &&
                index === getContextMenuItems().findIndex((i) => i.group === ACCEPT_REJECT_GROUP_NAME)
              ) {
                return (
                  <div key={`accept-reject-section-${index}`}>
                    <Menu.Divider />
                    <Menu.Label>{ACCEPT_REJECT_GROUP_NAME}</Menu.Label>
                    <Menu.Item
                      disabled={item.disabled}
                      leftSection={item.leftSection}
                      onClick={item.disabled ? undefined : () => handleContextMenuAction(item.label)}
                    >
                      {item.label}
                    </Menu.Item>
                  </div>
                );
              }

              // If this is an accept/reject item but not the first one, render normally
              if (isAcceptRejectItem) {
                return (
                  <Menu.Item
                    key={index}
                    disabled={item.disabled}
                    leftSection={item.leftSection}
                    onClick={item.disabled ? undefined : () => handleContextMenuAction(item.label)}
                  >
                    {item.label}
                  </Menu.Item>
                );
              }

              // For non-grouped items, add a divider before the first non-grouped item
              if (
                !isFocusItem &&
                !isFilteringItem &&
                !isAcceptRejectItem &&
                index === getContextMenuItems().findIndex((i) => !i.group)
              ) {
                return (
                  <div key={`other-section-${index}`}>
                    <Menu.Divider />
                    <Menu.Item
                      disabled={item.disabled}
                      leftSection={item.leftSection}
                      onClick={item.disabled ? undefined : () => handleContextMenuAction(item.label)}
                    >
                      {item.label}
                    </Menu.Item>
                  </div>
                );
              }

              // Regular items
              return (
                <Menu.Item
                  key={index}
                  disabled={item.disabled}
                  leftSection={item.leftSection}
                  onClick={item.disabled ? undefined : () => handleContextMenuAction(item.label)}
                >
                  {item.label}
                </Menu.Item>
              );
            })}
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
            {getHeaderMenuItems().map((item, index) => {
              // Check if this is a filtering item using the group property
              const isFilteringItem = item.group === FILTERING_GROUP_NAME;
              const isAcceptRejectItem = item.group === ACCEPT_REJECT_GROUP_NAME;

              // If this is the first filtering item, add the Filtering section header
              if (
                isFilteringItem &&
                index === getHeaderMenuItems().findIndex((i) => i.group === FILTERING_GROUP_NAME)
              ) {
                return (
                  <div key={`filtering-section-${index}`}>
                    <Menu.Divider />
                    <Menu.Label>{FILTERING_GROUP_NAME}</Menu.Label>
                    <Menu.Item
                      key={index}
                      disabled={item.disabled}
                      leftSection={item.leftSection}
                      onClick={item.disabled ? undefined : () => handleHeaderMenuAction(item.label)}
                    >
                      {item.label}
                    </Menu.Item>
                  </div>
                );
              }

              // If this is a filtering item but not the first one, render normally
              if (isFilteringItem) {
                return (
                  <Menu.Item
                    key={index}
                    disabled={item.disabled}
                    leftSection={item.leftSection}
                    onClick={item.disabled ? undefined : () => handleHeaderMenuAction(item.label)}
                  >
                    {item.label}
                  </Menu.Item>
                );
              }

              // If this is the first accept/reject item, add the Accept/Reject Changes section header
              if (
                isAcceptRejectItem &&
                index === getHeaderMenuItems().findIndex((i) => i.group === ACCEPT_REJECT_GROUP_NAME)
              ) {
                return (
                  <div key={`accept-reject-section-${index}`}>
                    <Menu.Divider />
                    <Menu.Label>{ACCEPT_REJECT_GROUP_NAME}</Menu.Label>
                    <Menu.Item
                      key={index}
                      disabled={item.disabled}
                      leftSection={item.leftSection}
                      onClick={item.disabled ? undefined : () => handleHeaderMenuAction(item.label)}
                    >
                      {item.label}
                    </Menu.Item>
                  </div>
                );
              }

              // If this is an accept/reject item but not the first one, render normally
              if (isAcceptRejectItem) {
                return (
                  <Menu.Item
                    key={index}
                    disabled={item.disabled}
                    leftSection={item.leftSection}
                    onClick={item.disabled ? undefined : () => handleHeaderMenuAction(item.label)}
                  >
                    {item.label}
                  </Menu.Item>
                );
              }

              // For non-grouped items, add a divider before the first non-grouped item
              if (
                !isFilteringItem &&
                !isAcceptRejectItem &&
                index === getHeaderMenuItems().findIndex((i) => !i.group)
              ) {
                return (
                  <div key={`other-section-${index}`}>
                    <Menu.Divider />
                    <Menu.Item
                      key={index}
                      disabled={item.disabled}
                      leftSection={item.leftSection}
                      onClick={item.disabled ? undefined : () => handleHeaderMenuAction(item.label)}
                    >
                      {item.label}
                    </Menu.Item>
                  </div>
                );
              }

              // Regular items
              return (
                <Menu.Item
                  key={index}
                  disabled={item.disabled}
                  leftSection={item.leftSection}
                  onClick={item.disabled ? undefined : () => handleHeaderMenuAction(item.label)}
                >
                  {item.label}
                </Menu.Item>
              );
            })}
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
