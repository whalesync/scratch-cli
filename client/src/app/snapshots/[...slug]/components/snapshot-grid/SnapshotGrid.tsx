'use client';

import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import {
  getHeaderColumnSpec,
  getOtherColumnSpecs,
  getTitleColumn,
} from '@/app/snapshots/[...slug]/components/snapshot-grid/header-column-utils';
import { SnapshotRecord } from '@/types/server-entities/snapshot';
import { Box, Center, Loader, Text, useMantineColorScheme } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import {
  AllCommunityModule,
  CellDoubleClickedEvent,
  CellStyleFunc,
  ColDef,
  GridApi,
  ModuleRegistry,
  ValueGetterFunc,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { AgGridReact } from 'ag-grid-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GridReadyEvent } from '../../../../../../node_modules/ag-grid-community/dist/types/src/events';
import { useSnapshotTableRecords } from '../../../../../hooks/use-snapshot-table-records';
import { useAgentChatContext } from '../contexts/agent-chat-context';
import { useTableContext } from '../contexts/table-context';
import { SnapshotTableGridProps } from '../types';
import { AG } from './ag-grid-constants';
import { CustomHeaderComponent } from './CustomHeaderComponent';
import RecordDetailsOverlay from './RecordDetailsOverlay';
import { RecordJsonModal } from './RecordJsonModal';
import styles from './SelectionCorners.module.css';
import { SettingsModal } from './SettingsModal';
import { TableContextMenu } from './TableContextMenu';
import { getCellClassFn } from './useCellClass';
import { useCellRenderer } from './useCellRenderer';
import { useSpecialColDefs } from './useSpecialColDefs';
import { useStoreColumnState } from './useStoreColumnState';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

export const SnapshotGrid = ({ snapshot, table, limited = false }: SnapshotTableGridProps) => {
  const { records, error, isLoading, acceptCellValues, rejectCellValues, updateRecordOptimistically } =
    useSnapshotTableRecords({
      snapshotId: snapshot.id,
      tableId: table.id.wsId,
    });
  const [gridApi, setGridApi] = useState<GridApi<SnapshotRecord> | null>(null);
  const { activeRecord, setActiveRecord, savePendingUpdates } = useTableContext();
  const { setRecordScope, setColumnScope, setTableScope } = useAgentChatContext();
  const clipboard = useClipboard({ timeout: 500 });

  // Record details mode state
  // const [recordDetailsVisible, setRecordDetailsVisible] = useState(false);
  // const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  // const [selectedColumnId, setSelectedColumnId] = useState<string | undefined>(undefined);
  const [overlayWidth, setOverlayWidth] = useState('50%'); // Default fallback
  const [jsonModalRecord, setJsonModalRecord] = useState<SnapshotRecord | null>(null);
  // const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  const recalculateOverlayWidth = useCallback(() => {
    if (gridApi) {
      // Get the width of the first 2 columns (ID and Title)
      // const dotColumn = getDotColumn(gridApi);
      const titleColumn = getTitleColumn(gridApi);

      let pinnedColumnsWidth = AG.dotColumn.width;

      // if (dotColumn) {
      //   pinnedColumnsWidth += dotColumn.getActualWidth();
      //   console.debug('ID column width:', dotColumn.getActualWidth());
      // }

      if (titleColumn) {
        pinnedColumnsWidth += titleColumn.getActualWidth();
        console.debug('Title column width:', titleColumn.getActualWidth());
      }

      // Calculate overlay width as 100% minus the pinned columns width
      const overlayWidthCalc = `calc(100% - ${pinnedColumnsWidth}px)`;
      setOverlayWidth(overlayWidthCalc);
    }

    // setRecordDetailsVisible(true);
  }, [gridApi]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
  });

  // Get theme from Mantine
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDarkTheme = colorScheme === 'dark';
  const isLightMode = colorScheme === 'light';

  // Settings modal state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Column header settings
  const [showDataTypeInHeader, setShowDataTypeInHeader] = useState(false);

  // We'll use gridApi.getFocusedCell() instead of tracking state

  // Track keyboard navigation state
  const [lastKeyPressed, setLastKeyPressed] = useState<KeyboardEvent | null>(null);

  // Track previous focused cell for shift selection logic (AG Grid doesn't provide this for keyboard navigation)
  const previousFocusedRowIndexRef = useRef<number | null>(null);

  // Track original column widths for auto-sizing toggle
  const originalColumnWidthsRef = useRef<Map<string, number>>(new Map());

  // Storage key for this specific snapshot and table
  const { columnState, mounted, onColumnStateChanged, clearColumnState } = useStoreColumnState(
    snapshot.id,
    table.id.wsId,
    gridApi,
  );

  // Handle grid ready to store API reference and apply column state immediately
  const onGridReady = useCallback(
    (params: GridReadyEvent<SnapshotRecord>) => {
      setGridApi(params.api);
      // Apply saved column state immediately when grid is ready to prevent animation
      if (columnState && columnState.length > 0) {
        params.api.applyColumnState({
          state: columnState,
          applyOrder: true,
        });
      }
    },
    [columnState],
  );

  // Keep original records as row data to preserve __suggested_values
  const rowData = records || [];

  const { cellRenderer } = useCellRenderer(table, acceptCellValues, rejectCellValues);
  const { idColumn, dotColumn } = useSpecialColDefs({
    onSettingsClick: () => setIsSettingsModalOpen(true),
    resizable: !activeRecord?.recordId,
    gridApi,
    recordDetailsVisible: !!activeRecord?.recordId,
  });

  // Context menu handlers
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleShowRecordJson = useCallback((record: SnapshotRecord) => {
    setJsonModalRecord(record);
  }, []);

  const handleRecordUpdate = useCallback(
    (recordId: string, field: string, value: string) => {
      updateRecordOptimistically(recordId, field, value);
    },
    [updateRecordOptimistically],
  );

  // Handlers for record details mode
  const handleCloseRecordDetails = useCallback(async () => {
    // Save any pending changes before closing
    if (savePendingUpdates) {
      await savePendingUpdates();
    }

    // Reset data scope back to table
    setActiveRecord(null);
    setTableScope();
    // Clear grid selection
    if (gridApi) {
      gridApi.deselectAll();
    }
  }, [gridApi, setActiveRecord, setTableScope, savePendingUpdates]);

  // Handle keyboard events for navigation tracking and shortcuts
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Handle Esc key to close record view
      if (event.key === 'Escape' && activeRecord?.recordId) {
        // event.preventDefault();
        handleCloseRecordDetails();
        return;
      }
      // Only handle keyboard events if they originate from within the AG Grid
      const target = event.target as HTMLElement;
      const isFromGrid = target?.closest('.ag-root-wrapper') !== null;

      if (!isFromGrid) {
        return; // Ignore events from outside the grid (like AI chat)
      }

      // Handle Enter key to open record view with current focused cell
      if (event.key === 'Enter' && !activeRecord?.recordId && gridApi) {
        event.preventDefault();
        const focusedCell = gridApi.getFocusedCell();
        if (focusedCell) {
          const rowNode = gridApi.getDisplayedRowAtIndex(focusedCell.rowIndex);
          const record = rowNode?.data as SnapshotRecord;
          const columnId = focusedCell.column.getColId();

          if (record && record.id?.wsId) {
            // Find the column definition to get the proper column ID
            const column = table.columns.find((col) => col.id.wsId === columnId);

            console.debug('Enter key pressed - opening record view:', {
              recordId: record.id.wsId,
              columnId: column?.id.wsId,
            });

            setActiveRecord({ recordId: record.id.wsId, columnId: column?.id.wsId });
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
    [activeRecord?.recordId, gridApi, handleCloseRecordDetails, table.columns, setActiveRecord, clipboard],
  );

  // Handle double click to open record view
  const handleCellDoubleClicked = useCallback(
    (event: CellDoubleClickedEvent<SnapshotRecord>) => {
      const record = event.data;
      const columnId = event.colDef?.field;

      if (record && record.id?.wsId) {
        // Find the column definition to get the proper column ID
        const column = table.columns.find((col) => col.id.wsId === columnId);

        recalculateOverlayWidth();
        setActiveRecord({ recordId: record.id.wsId, columnId: column?.id.wsId });
      }
    },
    [table.columns, setActiveRecord, recalculateOverlayWidth],
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
  const selectedRecord = activeRecord?.recordId
    ? records?.find((record) => record.id.wsId === activeRecord.recordId)
    : null;

  // Set record scope when a record is selected in details mode
  useEffect(() => {
    if (activeRecord?.recordId) {
      if (activeRecord.columnId) {
        setColumnScope(activeRecord.recordId, activeRecord.columnId);
      } else {
        setRecordScope(activeRecord.recordId);
      }
    }
  }, [activeRecord?.recordId, activeRecord?.columnId, setRecordScope, setColumnScope]);

  // Handlers for record details mode
  const handleFieldFocus = useCallback(
    (columnId: string | undefined) => {
      setActiveRecord({ recordId: activeRecord?.recordId, columnId: columnId });
    },
    [setActiveRecord, activeRecord?.recordId],
  );

  // Add keyboard event listener for copy functionality
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Find title column and other columns (moved up to be available in useEffect)
  const headerColumnSpecs = getHeaderColumnSpec(table);
  const otherColumnSpecs = getOtherColumnSpecs(table);

  // Always include all columns, but we'll control visibility via AG Grid API
  const columnsWithTitleFirst = headerColumnSpecs ? [headerColumnSpecs, ...otherColumnSpecs] : otherColumnSpecs;

  // Control column visibility based on limited mode only (not record details mode)
  useEffect(() => {
    if (gridApi && limited) {
      // Hide all columns except ID and Title (only for limited mode)
      const columnsToHide = otherColumnSpecs.map((col) => col.id.wsId);
      gridApi.setColumnsVisible(columnsToHide, false);
    } else if (gridApi && !limited) {
      // Show all columns (for normal mode and record details mode)
      const columnsToShow = otherColumnSpecs.map((col) => col.id.wsId);
      gridApi.setColumnsVisible(columnsToShow, true);
    }
  }, [gridApi, limited, otherColumnSpecs]);

  // Create column definitions from remaining table columns
  const dataColumns: ColDef[] = columnsWithTitleFirst.map((column, index) => {
    // const cellClass: CellClassFunc<SnapshotRecord, unknown> = (params) => {
    //   const classes: string[] = [];

    //   const focusedCell = gridApi?.getFocusedCell();
    //   const isInFocusedColumn =
    //     focusedCell && !activeRecord?.recordId && focusedCell.column.getColId() === column.id.wsId;

    //   if (isInFocusedColumn) {
    //     classes.push('ag-cell-focus-column');
    //   }

    //   // Add 'cell-edited' class if this field has been edited
    //   if (params.data?.__edited_fields?.[column.id.wsId]) {
    //     classes.push('cell-edited');
    //   }

    //   return classes;
    // };

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
      return params.data?.fields?.[column.id.wsId];
    };
    const colDef: ColDef = {
      field: column.id.wsId,
      headerName: column.name.toUpperCase(),
      sortable: true,
      filter: false,
      resizable: !activeRecord?.recordId,
      valueGetter,
      cellRenderer,
      cellStyle,
      cellClass: getCellClassFn({ gridApi, activeRecord, columnId: column.id.wsId }),
      // Pin the title column to the left (like the ID column)
      pinned: index === 0 ? 'left' : undefined,
      // Lock position and suppress movable for title column
      lockPosition: index === 0 ? true : false,
      // Use custom header component
      headerComponent: CustomHeaderComponent,
      headerComponentParams: {
        tableId: table.id.wsId,
        records: records,
        columnSpec: column,
        showDataTypeInHeader: showDataTypeInHeader,
      },
    };
    return colDef;
  });

  const headerColumnDef = dataColumns[0];
  const otherColumnDefs = dataColumns.slice(1);
  // Combine columns in order: ID, Title (if exists), data columns, then menu column
  const columnDefs: ColDef[] = [dotColumn, headerColumnDef, idColumn, ...otherColumnDefs];

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
        <Loader />
      </Center>
    );
  }

  return (
    <Box h="100%" w="100%" style={{ position: 'relative' }}>
      {/* AG Grid - always full width */}
      <div
        className={`${isDarkTheme ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} my-grid ${styles['ag-grid-container']}`}
        style={{
          height: '100%',
          width: '100%',
          overflow: 'auto',
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <AgGridReact<SnapshotRecord>
          rowData={rowData}
          columnDefs={columnDefs}
          getRowId={(params) => {
            return params.data.id.wsId;
          }}
          defaultColDef={{
            flex: AG.grid.defaultFlex,
            minWidth: AG.grid.defaultMinWidth,
            suppressKeyboardEvent: (params) => {
              // When record view is open, suppress arrow keys so record view can handle them
              if (
                activeRecord?.recordId &&
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
          onColumnResized={onColumnStateChanged}
          onColumnMoved={onColumnStateChanged}
          onColumnVisible={onColumnStateChanged}
          onCellDoubleClicked={handleCellDoubleClicked}
          onSelectionChanged={(event) => {
            if (activeRecord?.recordId) {
              // In record details mode, update the selected record state
              const selectedRows = event.api.getSelectedRows();
              if (selectedRows.length === 1) {
                const newSelectedId = selectedRows[0].id.wsId;
                setActiveRecord({ recordId: newSelectedId, columnId: activeRecord?.columnId });
              } else {
                setActiveRecord(null);
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

                if (currentRowNode && lastKeyPressed.shiftKey && !activeRecord?.recordId) {
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

      {/* Record Details Panel Overlay (only shown when showRecordDetails is true) */}
      {activeRecord?.recordId && selectedRecord && (
        <RecordDetailsOverlay
          width={overlayWidth}
          snapshotId={snapshot.id}
          selectedRecord={selectedRecord}
          activeRecord={activeRecord}
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
        tableColumns={table.columns}
        tableId={table.id.wsId}
        onShowRecordJson={handleShowRecordJson}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        isDarkTheme={isDarkTheme}
        onThemeToggle={toggleColorScheme}
        showDataTypeInHeader={showDataTypeInHeader}
        onShowDataTypeToggle={setShowDataTypeInHeader}
        onClearColumnState={clearColumnState}
      />

      {/* Record JSON Modal */}
      <RecordJsonModal isOpen={!!jsonModalRecord} onClose={() => setJsonModalRecord(null)} record={jsonModalRecord} />
    </Box>
  );
};

export default SnapshotGrid;
