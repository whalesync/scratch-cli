'use client';

import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SnapshotRecord } from '@/types/server-entities/snapshot';
import { Box, Center, Loader, Paper, ScrollArea, Text, useMantineColorScheme } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import {
  AllCommunityModule,
  CellClassFunc,
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
import { RecordDetails } from '../record-details/RecordDetails';
import { RecordDetailsHeader } from '../record-details/RecordDetailsHeader';
import { RecordSuggestionToolbar } from '../RecordSuggestionToolbar';
import { SnapshotTableGridProps } from '../types';
import { AG } from './ag-grid-constants';
import { CustomHeaderComponent } from './CustomHeaderComponent';
import { RecordJsonModal } from './RecordJsonModal';
import styles from './SelectionCorners.module.css';
import { SettingsModal } from './SettingsModal';
import { TableContextMenu } from './TableContextMenu';
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
  const { activeRecord } = useTableContext();
  const { setRecordScope, setColumnScope, setTableScope } = useAgentChatContext();
  const clipboard = useClipboard({ timeout: 500 });

  // Record details mode state
  const [recordDetailsVisible, setRecordDetailsVisible] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState<string | undefined>(undefined);
  const [overlayWidth, setOverlayWidth] = useState('50%'); // Default fallback
  const [jsonModalRecord, setJsonModalRecord] = useState<SnapshotRecord | null>(null);
  // const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  const showRecordDetails = useCallback(() => {
    if (gridApi) {
      // Get the width of the first 2 columns (ID and Title)
      const dotColumn = gridApi.getColumn('dot');
      let titleColumn = gridApi.getColumns()?.find((col) => col.getColDef().headerName?.toLowerCase() === 'title');
      if (!titleColumn) {
        titleColumn = (gridApi.getColumns() ?? []).filter(
          (col) => col.getColDef().headerName?.toLowerCase() !== 'id',
        )[0];
      }

      let pinnedColumnsWidth = 0;

      if (dotColumn) {
        pinnedColumnsWidth += dotColumn.getActualWidth();
        console.debug('ID column width:', dotColumn.getActualWidth());
      }

      if (titleColumn) {
        pinnedColumnsWidth += titleColumn.getActualWidth();
        console.debug('Title column width:', titleColumn.getActualWidth());
      }

      console.debug('Total pinned columns width:', pinnedColumnsWidth);

      // Calculate overlay width as 100% minus the pinned columns width
      const overlayWidthCalc = `calc(100% - ${pinnedColumnsWidth}px)`;
      setOverlayWidth(overlayWidthCalc);

      console.debug('Setting overlay width to:', overlayWidthCalc);
    }

    setRecordDetailsVisible(true);
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
    resizable: !recordDetailsVisible,
    gridApi,
    recordDetailsVisible,
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
  const handleCloseRecordDetails = useCallback(() => {
    setRecordDetailsVisible(false);
    setSelectedRecordId(null);
    setSelectedColumnId(undefined);
    // Reset data scope back to table
    setTableScope();
    // Clear grid selection
    if (gridApi) {
      gridApi.deselectAll();
    }
  }, [gridApi, setTableScope]);

  // Handle keyboard events for navigation tracking and shortcuts
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Handle Esc key to close record view
      if (event.key === 'Escape' && recordDetailsVisible) {
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
      if (event.key === 'Enter' && !recordDetailsVisible && gridApi) {
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

            setSelectedRecordId(record.id.wsId);
            setSelectedColumnId(column?.id.wsId);
            showRecordDetails();
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
        setTimeout(() => setLastKeyPressed(null), 100);
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

          console.debug(`Sorted column ${columnId} ${sortDirection}`);
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
    [gridApi, clipboard, recordDetailsVisible, handleCloseRecordDetails, showRecordDetails, table.columns],
  );

  // Handle double click to open record view
  const handleCellDoubleClicked = useCallback(
    (event: CellDoubleClickedEvent<SnapshotRecord>) => {
      const record = event.data;
      const columnId = event.colDef?.field;

      if (record && record.id?.wsId) {
        // Find the column definition to get the proper column ID
        const column = table.columns.find((col) => col.id.wsId === columnId);

        setSelectedRecordId(record.id.wsId);
        setSelectedColumnId(column?.id.wsId);
        showRecordDetails();
      }
    },
    [table.columns, showRecordDetails],
  );

  // Initialize record details mode from activeRecord (from double-click transition)
  useEffect(() => {
    if (activeRecord?.recordId && gridApi) {
      setSelectedRecordId(activeRecord.recordId);
      setSelectedColumnId(activeRecord.columnId);
      showRecordDetails();

      // Select the record in the grid and focus on ID column
      gridApi.deselectAll();
      const rowNode = gridApi.getRowNode(activeRecord.recordId);

      if (rowNode) {
        rowNode.setSelected(true);

        // Set focus to the ID column of the selected record
        const rowIndex = rowNode.rowIndex;
        if (rowIndex !== null && rowIndex !== undefined) {
          gridApi.setFocusedCell(rowIndex, 'id');
        }
      } else {
        gridApi.forEachNode((node) => {
          if (node.data && node.data.id?.wsId === activeRecord.recordId) {
            node.setSelected(true);
            if (node.rowIndex !== null && node.rowIndex !== undefined) {
              gridApi.setFocusedCell(node.rowIndex, 'id');
            }
          }
        });
      }
    }
  }, [activeRecord, gridApi, showRecordDetails]);

  // Get selected record from state
  const selectedRecord = selectedRecordId ? records?.find((record) => record.id.wsId === selectedRecordId) : null;

  // Set record scope when a record is selected in details mode
  useEffect(() => {
    if (recordDetailsVisible && selectedRecordId) {
      if (selectedColumnId) {
        setColumnScope(selectedRecordId, selectedColumnId);
      } else {
        setRecordScope(selectedRecordId);
      }
    }
  }, [recordDetailsVisible, selectedRecordId, selectedColumnId, setRecordScope, setColumnScope]);

  // Handlers for record details mode
  const handleFieldFocus = useCallback((columnId: string | undefined) => {
    setSelectedColumnId(columnId);
  }, []);

  // Add keyboard event listener for copy functionality
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Find title column and other columns (moved up to be available in useEffect)
  const titleColumnSpecs = table.columns.find((col) => col.name.toLowerCase() === 'title');
  const otherColumnSpecs = table.columns.filter((col) => col.name.toLowerCase() !== 'title');

  // Always include all columns, but we'll control visibility via AG Grid API
  const columnsWithTitleFirst = titleColumnSpecs ? [titleColumnSpecs, ...otherColumnSpecs] : otherColumnSpecs;

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
    const cellClass: CellClassFunc<SnapshotRecord, unknown> = (params) => {
      const classes: string[] = [];

      // Add 'cell-edited' class if this field has been edited
      if (params.data?.__edited_fields?.[column.id.wsId]) {
        classes.push('cell-edited');
      }

      return classes;
    };

    const cellStyle: CellStyleFunc<SnapshotRecord, unknown> = (params) => {
      const record = params.data;

      const hasSuggestion = record?.__edited_fields?.[column.id.wsId];
      const isReadOnly = column.readonly;

      // Check if this cell is in the same column as the focused cell
      const focusedCell = gridApi?.getFocusedCell();
      const isInFocusedColumn =
        focusedCell && !recordDetailsVisible && focusedCell.column.getColId() === column.id.wsId;

      // Base styles for all cells (gray outer border)
      const backgroundColor = isInFocusedColumn
        ? isLightMode
          ? 'var(--mantine-color-gray-4)'
          : 'var(--mantine-color-gray-7)'
        : 'transparent';
      const colors = isLightMode ? AG.colors.light : AG.colors.dark;
      const baseStyles = {
        backgroundColor,
        paddingLeft: AG.borders.paddingLeft,
        color: isReadOnly ? colors.readOnlyText : colors.normalText,
      };

      if (hasSuggestion) {
        return {
          ...baseStyles,
          // Use background gradient for inner border only (green suggestion border)
          // backgroundImage: `linear-gradient(to right, ${colors.innerBorder} 0px, ${colors.innerBorder} ${AG.borders.innerBorderWidth}, transparent ${AG.borders.innerBorderWidth})`,
          // backgroundSize: `${AG.borders.innerBorderWidth} ${AG.borders.innerBorderHeight}`,
          // backgroundPosition: '1px center',
          // backgroundRepeat: 'no-repeat',
        };
      }

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
      resizable: !recordDetailsVisible,
      valueGetter,
      cellRenderer,
      cellStyle,
      cellClass,
      // Pin the title column to the left (like the ID column)
      pinned: index === 0 ? 'left' : undefined,
      // Lock position and suppress movable for title column
      lockPosition: index === 0 ? true : false,
      // suppressMovable: column.name.toLowerCase() === 'title' ? true : false,
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
              // When record view is open, suppress left/right arrow keys so record view can handle them
              if (recordDetailsVisible && (params.event.key === 'ArrowLeft' || params.event.key === 'ArrowRight')) {
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
            if (recordDetailsVisible) {
              // In record details mode, update the selected record state
              const selectedRows = event.api.getSelectedRows();
              if (selectedRows.length === 1) {
                const newSelectedId = selectedRows[0].id.wsId;
                setSelectedRecordId(newSelectedId);
              } else {
                setSelectedRecordId(null);
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

                if (currentRowNode && lastKeyPressed.shiftKey && !recordDetailsVisible) {
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
      {recordDetailsVisible && (
        <Box
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: overlayWidth, // Dynamically calculated width
            height: '100%',
            // background: 'white',
            // border: '1px solid var(--mantine-color-gray-3)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
          }}
        >
          <Paper style={{ width: '100%', height: '100%', borderLeft: '1px solid var(--mantine-color-gray-3)' }}>
            {selectedRecord ? (
              <Box>
                <RecordDetailsHeader
                  h="36px"
                  table={table}
                  columnId={selectedColumnId}
                  onSwitchColumn={handleFieldFocus}
                  v2
                  onClose={handleCloseRecordDetails}
                />
                <Box p="sm" style={{ position: 'relative', height: '100%' }}>
                  {/* Determine if there are suggestions to adjust layout */}
                  {(() => {
                    const columnsWithSuggestions = Object.keys(selectedRecord?.__suggested_values || {});
                    const hasSuggestions =
                      columnsWithSuggestions.length > 0 &&
                      (!selectedColumnId || columnsWithSuggestions.includes(selectedColumnId));
                    const SUGGESTION_TOOLBAR_HEIGHT = 40;

                    return (
                      <>
                        <ScrollArea
                          h={hasSuggestions ? `calc(100vh - 190px)` : `calc(100vh - 150px)`}
                          type="hover"
                          scrollbars="y"
                        >
                          <RecordDetails
                            snapshotId={snapshot.id}
                            currentRecord={selectedRecord}
                            table={table}
                            currentColumnId={selectedColumnId}
                            acceptCellValues={acceptCellValues}
                            rejectCellValues={rejectCellValues}
                            onFocusOnField={handleFieldFocus}
                            onRecordUpdate={handleRecordUpdate}
                          />
                        </ScrollArea>
                        {hasSuggestions && (
                          <RecordSuggestionToolbar
                            record={selectedRecord}
                            table={table}
                            columnId={selectedColumnId}
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: `${SUGGESTION_TOOLBAR_HEIGHT}px`,
                            }}
                          />
                        )}
                      </>
                    );
                  })()}
                </Box>
              </Box>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--mantine-color-gray-6)',
                  fontSize: '14px',
                }}
              >
                Select a record to view its details
              </div>
            )}
          </Paper>
        </Box>
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
