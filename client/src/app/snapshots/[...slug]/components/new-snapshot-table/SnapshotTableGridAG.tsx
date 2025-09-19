'use client';

import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SnapshotRecord } from '@/types/server-entities/snapshot';
import { Box, Center, Loader, Text } from '@mantine/core';
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
import { AgGridReact } from 'ag-grid-react';
import { useCallback, useEffect, useState } from 'react';
import {
  FirstDataRenderedEvent,
  GridReadyEvent,
} from '../../../../../../node_modules/ag-grid-community/dist/types/src/events';
import { useSnapshotTableRecords } from '../../../../../hooks/use-snapshot-table-records';
import { useTableContext } from '../contexts/table-context';
import { SnapshotTableGridProps } from '../types';
import { AG } from './ag-grid-constants';

// Import AG Grid styles - using legacy theming
import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './ag-grid-variables.css';
import { CustomHeaderComponent } from './CustomHeaderComponent';
import styles from './SelectionCorners.module.css';
import { TableContextMenu } from './TableContextMenu';
import { useCellRenderer } from './useCellRenderer';
import { useIdColDef } from './useIdColDef';
import { useStoreColumnState } from './useStoreColumnState';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

export const SnapshotTableGridAG = ({ snapshot, table }: SnapshotTableGridProps) => {
  const { records, error, isLoading } = useSnapshotTableRecords({ snapshotId: snapshot.id, tableId: table.id.wsId });
  const [gridApi, setGridApi] = useState<GridApi<SnapshotRecord> | null>(null);
  const { switchToRecordView } = useTableContext();
  const clipboard = useClipboard({ timeout: 500 });
  // const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    // selectedRows: SnapshotRecord[];
    // clickedCell?: {
    //   recordId: string;
    //   fieldId: string;
    //   fieldName: string;
    // };
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    // selectedRows: [],
  });

  // Storage key for this specific snapshot and table
  const { columnState, mounted, onColumnStateChanged } = useStoreColumnState(snapshot.id, table.id.wsId, gridApi);

  // Handle grid ready to store API reference
  const onGridReady = useCallback((params: GridReadyEvent<SnapshotRecord>) => {
    setGridApi(params.api);
  }, []);

  // Apply saved column state after data is rendered
  const onFirstDataRendered = useCallback(
    (params: FirstDataRenderedEvent<SnapshotRecord>) => {
      if (columnState) {
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

  const { cellRenderer } = useCellRenderer(table);
  const { idColumn } = useIdColDef();

  // Generate unique cell ID for tracking selection
  const getCellId = (rowIndex: number, colId: string) => `${rowIndex}-${colId}`;

  // Context menu handlers
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Handle Ctrl/Cmd+C to copy focused cell content
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
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
    },
    [gridApi, clipboard],
  );

  // Handle double click to open record view
  const handleCellDoubleClicked = useCallback(
    (event: CellDoubleClickedEvent<SnapshotRecord>) => {
      const record = event.data;
      const columnId = event.colDef?.field;

      if (record && record.id?.wsId) {
        // Find the column definition to get the proper column ID
        const column = table.columns.find((col) => col.id.wsId === columnId);
        switchToRecordView(record.id.wsId, column?.id.wsId);
      }
    },
    [switchToRecordView, table.columns],
  );

  // Add keyboard event listener for copy functionality
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Find title column and other columns
  const titleColumn = table.columns.find((col) => col.name.toLowerCase() === 'title');
  const otherColumns = table.columns.filter((col) => col.name.toLowerCase() !== 'title');

  const columnsWithTitleFirst = titleColumn ? [titleColumn, ...otherColumns] : otherColumns;

  // Create column definitions from remaining table columns
  const dataColumns: ColDef[] = columnsWithTitleFirst.map((column) => {
    const cellStyle: CellStyleFunc<SnapshotRecord, unknown> = (params) => {
      const record = params.data;
      // if (!record) {
      //   return {
      //     background: 'transparent',
      //     backgroundSize: '0 0',
      //     backgroundPosition: 'left center',
      //     backgroundRepeat: 'no-repeat',
      //   };
      // }
      const hasSuggestion = record?.__suggested_values?.[column.id.wsId];
      const isReadOnly = column.readonly;

      // Base styles for all cells (gray outer border)
      const baseStyles = {
        background: `linear-gradient(to right, ${AG.colors.outerBorder} 0px, ${AG.colors.outerBorder} ${AG.borders.outerBorderWidth}, transparent ${AG.borders.outerBorderWidth})`,
        backgroundSize: `${AG.borders.outerBorderWidth} ${AG.borders.outerBorderHeight}`,
        backgroundPosition: 'left center',
        backgroundRepeat: 'no-repeat',
        paddingLeft: AG.borders.paddingLeft,
        color: isReadOnly ? AG.colors.readOnlyText : AG.colors.normalText,
      };

      if (hasSuggestion) {
        return {
          ...baseStyles,
          // Use background gradient for inner border with height control
          background: `
            linear-gradient(to right, ${AG.colors.innerBorder} 0px, ${AG.colors.innerBorder} ${AG.borders.innerBorderWidth}, transparent ${AG.borders.innerBorderWidth}),
            linear-gradient(to right, ${AG.colors.outerBorder} 0px, ${AG.colors.outerBorder} ${AG.borders.outerBorderWidth}, transparent ${AG.borders.outerBorderWidth})
          `,
          backgroundSize: `${AG.borders.innerBorderWidth} ${AG.borders.innerBorderHeight}, ${AG.borders.outerBorderWidth} ${AG.borders.outerBorderHeight}`,
          backgroundPosition: '1px center, left center',
          backgroundRepeat: 'no-repeat, no-repeat',
        };
      }

      return baseStyles;
    };
    const valueGetter: ValueGetterFunc<SnapshotRecord, unknown> = (params) => {
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
      // Use custom header component
      headerComponent: CustomHeaderComponent,
      headerComponentParams: {
        tableId: table.id.wsId,
        records: records,
        columnSpec: column,
      },
      // cellClass: () => {
      //   // const cellId = getCellId(params.node.rowIndex!, column.id.wsId);
      //   return styles['selected-cell-corners'];
      //   // return selectedCells.has(cellId) ? styles['selected-cell-corners'] : '';
      // },
    };
    return colDef;
  });

  // Combine columns in order: ID, Title (if exists), data columns, then menu column
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
        <Loader />
      </Center>
    );
  }

  return (
    <Box h="100%" w="100%" style={{ position: 'relative' }}>
      <div
        className={`ag-theme-alpine-dark my-grid ${styles['ag-grid-container']}`}
        style={{
          height: '100%',
          width: '100%',
          // Force scrollbars to be always visible
          overflow: 'auto',
        }}
        onContextMenu={(event) => {
          // Prevent default browser context menu on the entire grid area
          event.preventDefault();
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          // Prevent text selection during shift-click
          if (event.shiftKey) {
            event.preventDefault();
          }
        }}
      >
        <AgGridReact<SnapshotRecord>
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            flex: AG.grid.defaultFlex,
            minWidth: AG.grid.defaultMinWidth,
          }}
          rowHeight={31}
          headerHeight={31}
          // suppressRowHoverHighlight={true}
          animateRows={true}
          rowSelection="multiple"
          // suppressRowClickSelection={true}
          theme="legacy"
          onGridReady={onGridReady}
          onFirstDataRendered={onFirstDataRendered}
          onColumnResized={onColumnStateChanged}
          onColumnMoved={onColumnStateChanged}
          onColumnVisible={onColumnStateChanged}
          // Enable cell selection
          // enableRangeSelection={true}
          // cellSelection={true}
          // suppressRowDeselection={false}
          suppressCellFocus={false}
          enableCellTextSelection={false}
          // Prevent default context menu on the entire grid
          suppressContextMenu={true}
          // onCellClicked={(event) => {
          //   console.debug('Cell clicked:', event);

          //   // Update context menu with clicked cell info
          //   const record = event.data as SnapshotRecord;
          //   const column = table.columns.find((col) => col.id.wsId === event.column.getColId());

          //   if (record && column) {
          //     debugger;
          //     setContextMenu((prev) => ({
          //       ...prev,
          //       clickedCell: {
          //         recordId: record.id?.wsId || 'Unknown',
          //         fieldId: column.id.wsId,
          //         fieldName: column.name,
          //       },
          //     }));
          //   }
          // }}
          onCellDoubleClicked={handleCellDoubleClicked}
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
          onCellSelectionChanged={(event) => {
            console.debug('Cell selection changed:', event);
            const newSelectedCells = new Set<string>();

            // Get all selected cells from the grid
            if (gridApi) {
              const selectedRanges = gridApi.getCellRanges();
              if (selectedRanges) {
                selectedRanges.forEach((range) => {
                  const startRow = range.startRow?.rowIndex ?? 0;
                  const endRow = range.endRow?.rowIndex ?? 0;

                  // Add all cells in the range
                  for (let row = startRow; row <= endRow; row++) {
                    for (const col of range.columns) {
                      const cellId = getCellId(row, col.getColId());
                      newSelectedCells.add(cellId);
                    }
                  }
                });
              }
            }

            // setSelectedCells(newSelectedCells);
          }}
        />
      </div>

      {/* Context Menu */}
      <TableContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={handleCloseContextMenu}
        gridApi={gridApi}
        tableColumns={table.columns}
        tableId={table.id.wsId}
      />
    </Box>
  );
};

export default SnapshotTableGridAG;
