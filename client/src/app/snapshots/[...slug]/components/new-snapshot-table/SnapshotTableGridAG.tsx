'use client';

import { SnapshotRecord } from '@/types/server-entities/snapshot';
import { Box, Center, Loader, Text } from '@mantine/core';
import { AllCommunityModule, CellStyleFunc, ColDef, GridApi, ModuleRegistry, ValueGetterFunc } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useCallback, useState } from 'react';
import {
  FirstDataRenderedEvent,
  GridReadyEvent,
} from '../../../../../../node_modules/ag-grid-community/dist/types/src/events';
import { useSnapshotTableRecords } from '../../../../../hooks/use-snapshot-table-records';
import { SnapshotTableGridProps } from '../types';
import { AG } from './ag-grid-constants';

// Import AG Grid styles - using legacy theming
import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import styles from './SelectionCorners.module.css';
import { useCellRenderer } from './useCellRenderer';
import { useIdColDef } from './useIdColDef';
import { useMenuColDef } from './useMenuColDef';
import { useStoreColumnState } from './useStoreColumnState';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

export const SnapshotTableGridAG = ({ snapshot, table }: SnapshotTableGridProps) => {
  const { records, error, isLoading } = useSnapshotTableRecords({ snapshotId: snapshot.id, tableId: table.id.wsId });
  const [gridApi, setGridApi] = useState<GridApi<SnapshotRecord> | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

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
  const { menuColumn } = useMenuColDef();

  // Generate unique cell ID for tracking selection
  const getCellId = (rowIndex: number, colId: string) => `${rowIndex}-${colId}`;

  // Find title column and other columns
  const titleColumn = table.columns.find((col) => col.name.toLowerCase() === 'title');
  const otherColumns = table.columns.filter((col) => col.name.toLowerCase() !== 'title');

  const columnsWithTitleFirst = titleColumn ? [titleColumn, ...otherColumns] : otherColumns;

  // Create column definitions from remaining table columns
  const dataColumns: ColDef[] = columnsWithTitleFirst.map((column) => {
    const cellStyle: CellStyleFunc<SnapshotRecord, unknown> = (params) => {
      const record = params.data as SnapshotRecord;
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
          backgroundPosition: 'left center, left center',
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
      cellClass: (params) => {
        const cellId = getCellId(params.node.rowIndex!, column.id.wsId);
        return selectedCells.has(cellId) ? styles['selected-cell-corners'] : '';
      },
    };
    return colDef;
  });

  // Combine columns in order: ID, Title (if exists), data columns, then menu column
  const columnDefs: ColDef[] = [idColumn, ...dataColumns, menuColumn];

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
        className={`ag-theme-alpine-dark ${styles['ag-grid-container']}`}
        style={{
          height: '100%',
          width: '100%',
          // Force scrollbars to be always visible
          overflow: 'auto',
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
          cellSelection={true}
          // suppressRowDeselection={false}
          suppressCellFocus={false}
          enableCellTextSelection={true}
          onCellClicked={(event) => {
            console.debug('Cell clicked:', event);
            // Don't handle clicks on the menu column
            if (event.column.getColId() === 'menu') {
              return;
            }
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

            setSelectedCells(newSelectedCells);
          }}
        />
      </div>
    </Box>
  );
};

export default SnapshotTableGridAG;
