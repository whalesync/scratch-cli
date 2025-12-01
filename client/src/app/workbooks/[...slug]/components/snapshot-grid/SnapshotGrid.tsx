'use client';

import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import {
  getGridOrderedColumnSpecs,
  identifyRecordTitleColumn,
} from '@/app/workbooks/[...slug]/components/snapshot-grid/header-column-utils';
import { recordName } from '@/service-naming-conventions';
import { Service } from '@/types/server-entities/connector-accounts';
import { PostgresColumnType, SnapshotRecord } from '@/types/server-entities/workbook';
import { Box, Center, Text, useMantineColorScheme } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import {
  AllCommunityModule,
  CellDoubleClickedEvent,
  CellStyleFunc,
  ColDef,
  ColumnState,
  GridApi,
  GridReadyEvent,
  ModuleRegistry,
  ValueGetterFunc,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { AgGridReact } from 'ag-grid-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProcessedSnapshotRecord, useSnapshotTableRecords } from '../../../../../hooks/use-snapshot-table-records';
import { useWorkbookEditorUIStore } from '../../../../../stores/workbook-editor-store';
import { CustomHeaderComponent } from '../../../../components/field-value-wrappers/header/FieldHeaderComponent';
import { useAgentChatContext } from '../contexts/agent-chat-context';
import { useUpdateRecordsContext } from '../contexts/update-records-context';
import { GridSuggestionToolbar } from '../GridSuggestionToolbar';
import { SnapshotTableGridProps } from '../types';
import { AG, ID_COLUMN_FIELD } from './ag-grid-constants';
import { getComparatorFunctionForColumnSpec } from './comparators';
import RecordDetailsOverlay from './RecordDetailsOverlay';
import { RecordJsonModal } from './RecordJsonModal';
import styles from './SelectionCorners.module.css';
import { TableContextMenu } from './TableContextMenu';
import { getCellClassFn } from './useCellClass';
import { useCellRenderer } from './useCellRenderer';
import { useSpecialColDefs } from './useSpecialColDefs';
import { useStoreColumnState } from './useStoreColumnState';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

export const SnapshotGrid = ({ workbook, table, limited = false }: SnapshotTableGridProps) => {
  const { records, error, isLoading, acceptCellValues, rejectCellValues, recordDataHash, columnChangeTypes } =
    useSnapshotTableRecords({
      workbookId: workbook.id,
      tableId: table.id,
      generateHash: true,
    });
  const activeCells = useWorkbookEditorUIStore((state) => state.activeCells);
  const setActiveCells = useWorkbookEditorUIStore((state) => state.setActiveCells);
  const [gridApi, setGridApi] = useState<GridApi<ProcessedSnapshotRecord> | null>(null);
  const { savePendingChanges } = useUpdateRecordsContext();
  const { setRecordScope, setColumnScope, setTableScope } = useAgentChatContext();
  const clipboard = useClipboard({ timeout: 500 });

  // Find title column and other columns
  const { columns: columnSpecs, titleColumnId } = getGridOrderedColumnSpecs(table.tableSpec, table.hiddenColumns);

  // Record details mode state
  const [overlayWidth, setOverlayWidth] = useState('50%'); // Default fallback
  const [jsonModalRecord, setJsonModalRecord] = useState<SnapshotRecord | null>(null);

  const lastRecordDataHash = useRef<number>(0);

  useEffect(() => {
    if (records && gridApi) {
      // NOTE: this is called when the records are updated, so it's not called when the records are filtered, sorted, etc.
      // We need to evaluate the current selection and focus state of the grid and reset values if certain cells are no longer visible
      // as well as ensure styling is reapplied correctly to avoid inconsistencies between old and new data in the grid
      // The goal is to do all of this through AG Grid's API -- not manually changing state or classes

      if (recordDataHash != lastRecordDataHash.current) {
        console.debug('Record set changed, reset selected cell', {
          records: records.length,
          hash: recordDataHash,
        });
        // clear all current selections to clean up the table
        gridApi.deselectAll();

        const focusedCell = gridApi.getFocusedCell();
        if (activeCells?.recordId && !records.some((record) => record.id.wsId === activeCells.recordId)) {
          // active record is not in the new record set, close the overlay and clear focus
          setActiveCells(null);
          gridApi.clearFocusedCell();
        } else if (activeCells?.recordId) {
          // active record is still in the new records, update the grid selection to the new location of the active record
          gridApi.forEachNode((node) => {
            if (node.data?.id.wsId === activeCells.recordId) {
              // select the row
              node.setSelected(true);
              return;
            }
          });
        } else if (focusedCell) {
          // Check if the old focused cell is still visible, if not clear the focus, otherwise ensure the row is properly selected
          const rowNode = gridApi.getDisplayedRowAtIndex(focusedCell.rowIndex);
          if (rowNode) {
            rowNode.setSelected(true);
          } else {
            // row & cell is no longer visible
            gridApi.clearFocusedCell();
          }
        }

        // refresh the cells to ensure styling is reapplied correctly
        gridApi.refreshCells();

        // record the hash of this new record set so we can compare it next time
        lastRecordDataHash.current = recordDataHash;
      }
    }
  }, [records, gridApi, activeCells, setActiveCells, recordDataHash]);

  const recalculateOverlayWidth = useCallback(() => {
    if (gridApi) {
      // Get the width of the first 3 pinned columns (dot, ID, and Title)
      // Use the table spec to identify the title column (respects titleColumnRemoteId)
      const titleColumnWsId = identifyRecordTitleColumn(table.tableSpec);
      const titleColumn = gridApi.getColumns()?.find((col) => col.getColDef().field === titleColumnWsId);
      const idColumn = gridApi.getColumns()?.find((col) => col.getColDef().field === ID_COLUMN_FIELD);

      let pinnedColumnsWidth = 0; //AG.dotColumn.width;

      if (idColumn) {
        pinnedColumnsWidth += idColumn.getActualWidth();
        console.debug('ID column width:', idColumn.getActualWidth());
      }

      if (titleColumn) {
        pinnedColumnsWidth += titleColumn.getActualWidth();
        console.debug('Title column width:', titleColumn.getActualWidth());
      }

      // Calculate overlay width as 100% minus the pinned columns width, with extra pixels to show resize handle
      const overlayWidthCalc = `calc(100% - ${pinnedColumnsWidth}px)`;
      setOverlayWidth(overlayWidthCalc);
    }

    // setRecordDetailsVisible(true);
  }, [gridApi, table]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
  });

  // Get theme from Mantine
  const { colorScheme } = useMantineColorScheme();
  const isDarkTheme = colorScheme === 'dark';
  const isLightMode = colorScheme === 'light';

  // We'll use gridApi.getFocusedCell() instead of tracking state

  // Track keyboard navigation state
  const [lastKeyPressed, setLastKeyPressed] = useState<KeyboardEvent | null>(null);

  // Track previous focused cell for shift selection logic (AG Grid doesn't provide this for keyboard navigation)
  const previousFocusedRowIndexRef = useRef<number | null>(null);

  // Track original column widths for auto-sizing toggle
  const originalColumnWidthsRef = useRef<Map<string, number>>(new Map());

  // Storage key for this specific snapshot and table
  const { columnState, mounted, onColumnStateChanged } = useStoreColumnState(workbook.id, table.id, gridApi);

  // Handle column resize to update overlay width when record details are visible
  const handleColumnResized = useCallback(() => {
    onColumnStateChanged();
    // Recalculate overlay width if the overlay is visible
    if (activeCells?.recordId) {
      recalculateOverlayWidth();
    }
  }, [onColumnStateChanged, activeCells?.recordId, recalculateOverlayWidth]);

  // Handle grid ready to store API reference and apply column state immediately
  const onGridReady = useCallback(
    (params: GridReadyEvent<ProcessedSnapshotRecord>) => {
      setGridApi(params.api);
      // Apply saved column state immediately when grid is ready to prevent animation
      if (columnState && columnState.length > 0) {
        // Ensure ID and Header columns are always first in the state
        // This fixes an issue where local storage might have an old order
        const idColId = ID_COLUMN_FIELD;

        // Filter out ID and Header columns from the saved state
        const otherColumnsState = columnState.filter((col) => col.colId !== idColId && col.colId !== titleColumnId);

        // Find the saved state for ID and Header columns (to preserve width, etc.)
        const idColState = columnState.find((col) => col.colId === idColId);
        const headerColState = columnState.find((col) => col.colId === titleColumnId);

        // Construct the new state with enforced order
        const newState: ColumnState[] = [];

        if (idColState) newState.push(idColState);
        if (headerColState) newState.push(headerColState);

        newState.push(...otherColumnsState);

        params.api.applyColumnState({
          state: newState,
          applyOrder: true,
        });
      }
    },
    [columnState, titleColumnId],
  );

  // Keep original records as row data to preserve __suggested_values
  const rowData = records || [];

  const { cellRenderer } = useCellRenderer(table.tableSpec, columnChangeTypes, acceptCellValues, rejectCellValues);

  // Handler to open overlay from ID cell
  const handleOpenOverlayFromId = useCallback(
    (recordId: string) => {
      recalculateOverlayWidth();
      setActiveCells({ recordId, columnId: undefined });
    },
    [recalculateOverlayWidth, setActiveCells],
  );

  const { idColumn } = useSpecialColDefs({
    entityName: recordName(table.connectorService as Service),
    resizable: true,
    gridApi,
    recordDetailsVisible: !!activeCells?.recordId,
    tableSpec: table.tableSpec,
    columnChangeTypes,
    onOpenOverlay: handleOpenOverlayFromId,
  });

  // Context menu handlers
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleShowRecordJson = useCallback((record: SnapshotRecord) => {
    setJsonModalRecord(record);
  }, []);

  const handleRecordUpdate = useCallback(() => {
    // TODO: Remove.
  }, []);

  // Handlers for record details mode
  const handleCloseRecordDetails = useCallback(async () => {
    // Save any pending changes before closing
    if (savePendingChanges) {
      await savePendingChanges();
    }

    // Reset data scope back to table
    setActiveCells(null);
    setTableScope();
    // Clear grid selection
    if (gridApi) {
      gridApi.deselectAll();
    }
  }, [gridApi, setActiveCells, setTableScope, savePendingChanges]);

  // Handle keyboard events for navigation tracking and shortcuts
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Handle Esc key to close record view or clear selection
      if (event.key === 'Escape') {
        if (activeCells?.recordId) {
          // Close record details overlay
          handleCloseRecordDetails();
        } else if (gridApi) {
          // Clear all selections in regular table view
          gridApi.deselectAll();
          gridApi.clearFocusedCell();
          // Refresh cells to remove column highlighting
          gridApi.refreshCells({ force: true });
        }
        return;
      }
      // Only handle keyboard events if they originate from within the AG Grid
      const target = event.target as HTMLElement;
      const isFromGrid = target?.closest('.ag-root-wrapper') !== null;

      if (!isFromGrid) {
        return; // Ignore events from outside the grid (like AI chat)
      }

      // Handle Enter key to open record view with current focused cell
      if (event.key === 'Enter' && !activeCells?.recordId && gridApi) {
        event.preventDefault();
        const focusedCell = gridApi.getFocusedCell();
        if (focusedCell) {
          const rowNode = gridApi.getDisplayedRowAtIndex(focusedCell.rowIndex);
          const record = rowNode?.data as SnapshotRecord;
          const columnId = focusedCell.column.getColId();

          if (record && record.id?.wsId) {
            // Find the column definition to get the proper column ID
            const column = table.tableSpec.columns.find((col) => col.id.wsId === columnId);

            console.debug('Enter key pressed - opening record view:', {
              recordId: record.id.wsId,
              columnId: column?.id.wsId,
            });

            recalculateOverlayWidth();

            setActiveCells({ recordId: record.id.wsId, columnId: column?.id.wsId });
            // setSelectedRecordId(record.id.wsId);
            // setSelectedColumnId(column?.id.wsId);
            // showRecordDetails();
          }
        }
        return;
      }

      // Track arrow key presses for navigation detection
      if (
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight'
      ) {
        setLastKeyPressed(event);
        // Clear the key after a short delay to avoid false positives
        setTimeout(() => setLastKeyPressed(null), 50);
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        if (!gridApi) return;

        const focusedCell = gridApi.getFocusedCell();
        if (focusedCell) {
          const rowNode = gridApi.getRowNode(focusedCell.rowIndex.toString());
          const record = rowNode?.data as SnapshotRecord;
          const columnId = focusedCell.column.getColId();

          if (record) {
            // Get the current cell value
            const cellValue = record.fields?.[columnId];
            let valueToCopy: string | null = null;
            let isFromSuggestion = false;

            // If current value is null/undefined/empty, try suggested value
            if (cellValue === null || cellValue === undefined || cellValue === '') {
              const suggestedValue = record.__suggested_values?.[columnId];
              if (suggestedValue !== null && suggestedValue !== undefined && suggestedValue !== '') {
                valueToCopy = String(suggestedValue);
                isFromSuggestion = true;
              }
            } else {
              valueToCopy = String(cellValue);
            }

            if (valueToCopy) {
              clipboard.copy(valueToCopy);
              ScratchpadNotifications.success({
                title: `Cell Content Copied${isFromSuggestion ? ' (Suggested Value)' : ''}`,
                message: `Copied: ${valueToCopy.length > 50 ? valueToCopy.substring(0, 50) + '...' : valueToCopy}`,
              });
            } else {
              ScratchpadNotifications.warning({
                title: 'No Value to Copy',
                message: 'The selected cell has no value or suggested value to copy',
              });
            }
          }
        }
      }

      // Sort shortcuts: [ for ascending, ] for descending
      if (event.key === '[' || event.key === ']') {
        if (!gridApi) return;

        const focusedCell = gridApi.getFocusedCell();
        if (focusedCell) {
          const columnId = focusedCell.column.getColId();

          if (columnId === '0') {
            return;
          }
          const sortDirection = event.key === '[' ? 'asc' : 'desc';

          // Apply sort to the focused column
          gridApi.applyColumnState({
            state: [
              {
                colId: columnId,
                sort: sortDirection,
              },
            ],
            defaultState: { sort: null }, // Clear sort from other columns
          });

          // refocus the cell after sorting to keep the focus on the GridView
          gridApi.setFocusedCell(focusedCell.rowIndex, focusedCell.column);
        }
      }

      // Toggle auto-size for focused column when 'w' is pressed
      if (event.key.toLowerCase() === 'w') {
        if (!gridApi) return;

        const focusedCell = gridApi.getFocusedCell();
        if (focusedCell) {
          const columnId = focusedCell.column.getColId();
          if (columnId === '0') {
            // ignore for the dot column
            return;
          }
          const column = gridApi.getColumn(columnId);

          if (column) {
            const currentWidth = column.getActualWidth();
            const originalWidths = originalColumnWidthsRef.current;

            if (originalWidths.has(columnId)) {
              // Revert to original width
              const originalWidth = originalWidths.get(columnId)!;
              gridApi.setColumnWidths([{ key: columnId, newWidth: originalWidth }]);
              originalWidths.delete(columnId);
              console.debug(`Reverted column ${columnId} to original width: ${originalWidth}px`);
            } else {
              // Store current width and auto-size
              originalWidths.set(columnId, currentWidth);
              gridApi.autoSizeColumns([columnId]);
              console.debug(`Auto-sized column ${columnId}, stored original width: ${currentWidth}px`);
            }
          }
        }
      }
    },
    [
      activeCells?.recordId,
      gridApi,
      handleCloseRecordDetails,
      table.tableSpec.columns,
      setActiveCells,
      clipboard,
      recalculateOverlayWidth,
    ],
  );

  // Handle double click to open record view
  const handleCellDoubleClicked = useCallback(
    (event: CellDoubleClickedEvent<ProcessedSnapshotRecord>) => {
      const record = event.data;
      const columnId = event.colDef?.field;

      if (record && record.id?.wsId) {
        // Find the column definition to get the proper column ID
        const column = table.tableSpec.columns.find((col) => col.id.wsId === columnId);

        recalculateOverlayWidth();
        setActiveCells({ recordId: record.id.wsId, columnId: column?.id.wsId });
      }
    },
    [table.tableSpec.columns, setActiveCells, recalculateOverlayWidth],
  );

  const handleMoveCellFocus = useCallback(
    (direction: 'up' | 'down') => {
      if (!gridApi) return;

      const focusedCell = gridApi.getFocusedCell();

      if (focusedCell) {
        // Calculate the row index one row higher (ensure it doesn't go below 0)
        const newRowIndex = Math.max(0, focusedCell.rowIndex - (direction === 'up' ? 1 : -1));

        // Set focus to the same column but one row higher
        gridApi.setFocusedCell(newRowIndex, focusedCell.column);

        // console.debug(`Moved focus from row ${focusedCell.rowIndex} to row ${newRowIndex}`);
      }
    },
    [gridApi],
  );

  // Get selected record from state
  const selectedRecord = activeCells?.recordId
    ? records?.find((record) => record.id.wsId === activeCells.recordId)
    : null;

  // Set record scope when a record is selected in details mode
  useEffect(() => {
    if (activeCells?.recordId) {
      if (activeCells.columnId) {
        setColumnScope(activeCells.recordId, activeCells.columnId);
      } else {
        setRecordScope(activeCells.recordId);
      }
    }
  }, [activeCells?.recordId, activeCells?.columnId, setRecordScope, setColumnScope]);

  // Handlers for record details mode
  const handleFieldFocus = useCallback(
    (columnId: string | undefined) => {
      setActiveCells({ recordId: activeCells?.recordId, columnId: columnId });
    },
    [setActiveCells, activeCells?.recordId],
  );

  // Add keyboard event listener for copy functionality
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Find title column and other columns (moved up to be available in useEffect)

  // Control column visibility based on limited mode only (not record details mode)
  useEffect(() => {
    if (gridApi && limited) {
      // Hide all columns except ID and Title (only for limited mode)
      const columnsToHide = columnSpecs.filter((c) => c.id.wsId !== titleColumnId).map((col) => col.id.wsId);
      gridApi.setColumnsVisible(columnsToHide, false);
    } else if (gridApi && !limited) {
      // Show all columns (for normal mode and record details mode)
      const columnsToShow = columnSpecs.map((col) => col.id.wsId);
      gridApi.setColumnsVisible(columnsToShow, true);
    }
  }, [gridApi, limited, columnSpecs, titleColumnId]);

  // Show suggestion toolbar if there are suggestions and no record is active
  const showSuggestionToolbar = useMemo(() => {
    return (
      records &&
      records.some((record) => record.__suggested_values && Object.keys(record.__suggested_values).length > 0) &&
      !activeCells?.recordId
    );
  }, [records, activeCells?.recordId]);

  // Create column definitions from remaining table columns
  const dataColumns: ColDef[] = columnSpecs.map((column, index) => {
    const cellStyle: CellStyleFunc<SnapshotRecord, unknown> = () => {
      const isReadOnly = column.readonly;
      const colors = isLightMode ? AG.colors.light : AG.colors.dark;
      const baseStyles = {
        // backgroundColor,
        color: isReadOnly ? colors.readOnlyText : colors.normalText,
      };

      return baseStyles;
    };
    const valueGetter: ValueGetterFunc<SnapshotRecord, unknown> = (params) => {
      if (column.pgType === PostgresColumnType.TIMESTAMP && params.data?.fields?.[column.id.wsId]) {
        // SnapshotRecords get dates as ISO strings, so we need to convert them to dates to handle them natively in the grid
        return new Date(params.data?.fields?.[column.id.wsId] as string | Date).toLocaleDateString();
      }
      return params.data?.fields?.[column.id.wsId];
    };
    const colDef: ColDef = {
      field: column.id.wsId,
      headerName: column.name,
      sortable: true,
      filter: false,
      resizable: true,
      valueGetter,
      cellRenderer,
      cellStyle,
      cellClass: getCellClassFn({ gridApi, activeCells, columnId: column.id.wsId }),
      // Pin the title column to the left (like the ID column)
      pinned: index === 0 ? 'left' : undefined,
      // Lock position and suppress movable for title column
      lockPosition: index === 0 ? true : false,
      // Use custom header component
      headerComponent: CustomHeaderComponent,
      headerComponentParams: {
        tableId: table.id,
        records: records,
        columnSpec: column,
      },
      comparator: getComparatorFunctionForColumnSpec(column),
      cellDataType:
        column.pgType === PostgresColumnType.TIMESTAMP
          ? column.metadata?.dateFormat === 'date'
            ? 'date'
            : 'datetime'
          : undefined, // explicitly set the data type for the cell
    };
    return colDef;
  });

  // Always put the ID column first.
  const columnDefs: ColDef[] = [idColumn, ...dataColumns];

  if (error) {
    return (
      <Center h="100%">
        <Text c="red">Error loading records: {error.message}</Text>
      </Center>
    );
  }

  if (!mounted || (isLoading && !records)) {
    return (
      <Center h="100%">
        <LoaderWithMessage message="Loading records..." centered />
      </Center>
    );
  }

  return (
    <Box h="100%" w="100%" style={{ position: 'relative' }}>
      {/* AG Grid - always full width */}
      <div
        className={`${isDarkTheme ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} my-grid ${styles['ag-grid-container']}`}
        style={{
          height: showSuggestionToolbar ? 'calc(100% - 28px)' : '100%',
          width: '100%',
          overflow: 'auto',
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <AgGridReact<ProcessedSnapshotRecord>
          rowData={rowData}
          columnDefs={columnDefs}
          getRowId={(params) => {
            return params.data.id.wsId;
          }}
          defaultColDef={{
            flex: AG.grid.defaultFlex,
            minWidth: AG.grid.defaultMinWidth,
            suppressKeyboardEvent: (params) => {
              // Suppress Escape key - we handle it in our custom handler
              if (params.event.key === 'Escape') {
                return true; // Suppress AG Grid's default Escape behavior
              }

              // When record view is open, suppress arrow keys so record view can handle them
              if (
                activeCells?.recordId &&
                (params.event.key === 'ArrowLeft' ||
                  params.event.key === 'ArrowRight' ||
                  params.event.key === 'ArrowUp' ||
                  params.event.key === 'ArrowDown')
              ) {
                return true; // Suppress the keyboard event
              }
              return false; // Allow the keyboard event
            },
          }}
          rowHeight={36}
          headerHeight={35}
          animateRows={false}
          suppressColumnMoveAnimation={true}
          suppressAnimationFrame={true}
          rowSelection="multiple"
          theme="legacy"
          suppressCellFocus={false}
          enableCellTextSelection={false}
          suppressContextMenu={false}
          suppressFocusAfterRefresh={true}
          maintainColumnOrder={true}
          stopEditingWhenCellsLoseFocus={false}
          onGridReady={onGridReady}
          onColumnResized={handleColumnResized}
          onColumnMoved={onColumnStateChanged}
          onColumnVisible={onColumnStateChanged}
          onCellDoubleClicked={handleCellDoubleClicked}
          onSelectionChanged={(event) => {
            if (activeCells?.recordId) {
              // In record details mode, update the selected record state
              const selectedRows = event.api.getSelectedRows();
              if (selectedRows.length === 1) {
                const newSelectedId = selectedRows[0].id.wsId;
                setActiveCells({ recordId: newSelectedId, columnId: activeCells?.columnId });
              } else {
                setActiveCells(null);
              }
            }
            // Note: Normal mode callback handling was removed as per user's changes
          }}
          onCellContextMenu={(event) => {
            // Prevent the default browser context menu
            event.event?.preventDefault();
            event.event?.stopPropagation();

            if (!gridApi) return;

            const rowNode = event.node;

            if (rowNode) {
              // Check if the right-clicked row is already selected
              const isRowSelected = rowNode.isSelected();

              if (!isRowSelected) {
                // Clear current selection and select only the right-clicked row
                gridApi.deselectAll();
                rowNode.setSelected(true);
              }
            }

            const mouseEvent = event.event as MouseEvent;
            setContextMenu({
              isOpen: true,
              position: { x: mouseEvent?.clientX || 0, y: mouseEvent?.clientY || 0 },
            });
          }}
          onCellFocused={(event) => {
            // Check if this focus event was caused by arrow key navigation
            if (lastKeyPressed && (lastKeyPressed.key === 'ArrowUp' || lastKeyPressed.key === 'ArrowDown')) {
              console.log('🔥 Cell focus changed due to arrow key:', lastKeyPressed.key, 'Row:', event.rowIndex);

              if (gridApi && event.rowIndex !== null && event.rowIndex !== undefined) {
                const currentRowNode = gridApi.getDisplayedRowAtIndex(event.rowIndex);

                if (currentRowNode && lastKeyPressed.shiftKey && !activeCells?.recordId) {
                  // Shift+Arrow key logic (only in normal mode)
                  if (!currentRowNode.isSelected()) {
                    currentRowNode.setSelected(true);
                  } else if (
                    previousFocusedRowIndexRef.current !== null &&
                    previousFocusedRowIndexRef.current !== undefined
                  ) {
                    const previousRowNode = gridApi.getDisplayedRowAtIndex(previousFocusedRowIndexRef.current);
                    if (previousRowNode) {
                      previousRowNode.setSelected(false);
                    }
                  }
                } else if (!lastKeyPressed.shiftKey) {
                  // Regular arrow key navigation
                  gridApi.deselectAll();
                  currentRowNode?.setSelected(true);
                }
              }
            }

            // Update previous focused row index for next shift selection
            previousFocusedRowIndexRef.current = event.rowIndex;

            // Force refresh of all cell styles when focus changes
            if (gridApi) {
              gridApi.refreshCells({ force: true });
            }
          }}
        />
      </div>

      {showSuggestionToolbar && <GridSuggestionToolbar table={table} />}

      {/* Record Details Panel Overlay (only shown when showRecordDetails is true) */}
      {activeCells?.recordId && selectedRecord && (
        <RecordDetailsOverlay
          width={overlayWidth}
          workbookId={workbook.id}
          selectedRecord={selectedRecord}
          activeCells={activeCells}
          table={table}
          handleFieldFocus={handleFieldFocus}
          handleCloseRecordDetails={handleCloseRecordDetails}
          acceptCellValues={acceptCellValues}
          rejectCellValues={rejectCellValues}
          handleRecordUpdate={handleRecordUpdate}
          handleRowNavigation={(direction, event) => {
            handleMoveCellFocus(direction);
            if (event) {
              setLastKeyPressed(event);
              setTimeout(() => setLastKeyPressed(null), 50);
            }
          }}
        />
      )}

      {/* Context Menu */}
      <TableContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={handleCloseContextMenu}
        gridApi={gridApi}
        tableColumns={table.tableSpec.columns}
        tableId={table.id}
        onShowRecordJson={handleShowRecordJson}
      />

      {/* Record JSON Modal */}
      <RecordJsonModal isOpen={!!jsonModalRecord} onClose={() => setJsonModalRecord(null)} record={jsonModalRecord} />

      {/* 
      Sync In Progress Overlay. Temp solution until we have design.
      Table will be stil clickable but the overlay will indicate that sync is in progress.
      */}
      {table.syncInProgress && (
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: isDarkTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'all',
          }}
        >
          <Center>
            <LoaderWithMessage centered message="Syncing..." />
          </Center>
        </Box>
      )}
    </Box>
  );
};

export default SnapshotGrid;
