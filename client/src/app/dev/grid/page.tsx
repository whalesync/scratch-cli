'use client';

import '@/ag-grid-css';
import MainContent from '@/app/components/layouts/MainContent';
import { Checkbox, Group, Stack, Text, useMantineColorScheme } from '@mantine/core';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useState } from 'react';
import { GridRow } from './GridRow';

// Column widths
const ID_COLUMN_WIDTH = 100;
const NAME_COLUMN_WIDTH = 550;
const TOTAL_WIDTH = ID_COLUMN_WIDTH + NAME_COLUMN_WIDTH;

// Configuration types
type RowConfig = {
  selected: boolean;
  hover: boolean;
};

type CellConfig = {
  focused: boolean;
  focusColumn: boolean;
  edited: boolean;
  withGreenDot: boolean;
  withRedDot: boolean;
};

type GridConfig = {
  [rowIndex: number]: {
    rowConfig: RowConfig;
    cellConfigs: {
      [cellIndex: number]: CellConfig;
    };
  };
};

export default function DevGridPage() {
  // State for which cell is currently selected for editing
  const [selectedCell, setSelectedCell] = useState<{ row: number; cell: number }>({ row: 0, cell: 0 });

  // Configuration for all rows and cells
  const [config, setConfig] = useState<GridConfig>({
    0: {
      rowConfig: { selected: false, hover: false },
      cellConfigs: {
        0: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
        1: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
      },
    },
    1: {
      rowConfig: { selected: false, hover: false },
      cellConfigs: {
        0: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
        1: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
      },
    },
    2: {
      rowConfig: { selected: false, hover: false },
      cellConfigs: {
        0: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
        1: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
      },
    },
    3: {
      rowConfig: { selected: false, hover: false },
      cellConfigs: {
        0: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
        1: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
      },
    },
    4: {
      rowConfig: { selected: false, hover: false },
      cellConfigs: {
        0: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
        1: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
      },
    },
    5: {
      rowConfig: { selected: false, hover: false },
      cellConfigs: {
        0: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
        1: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
      },
    },
    6: {
      rowConfig: { selected: false, hover: false },
      cellConfigs: {
        0: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
        1: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
      },
    },
    7: {
      rowConfig: { selected: false, hover: false },
      cellConfigs: {
        0: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
        1: { focused: false, focusColumn: false, edited: false, withGreenDot: false, withRedDot: false },
      },
    },
  });

  // Get theme from Mantine
  const { colorScheme } = useMantineColorScheme();
  const isDarkTheme = colorScheme === 'dark';

  // Handlers for updating config
  const updateRowConfig = (rowIndex: number, key: keyof RowConfig, value: boolean) => {
    setConfig((prev) => ({
      ...prev,
      [rowIndex]: {
        ...prev[rowIndex],
        rowConfig: {
          ...prev[rowIndex].rowConfig,
          [key]: value,
        },
      },
    }));
  };

  const updateCellConfig = (rowIndex: number, cellIndex: number, key: keyof CellConfig, value: boolean) => {
    setConfig((prev) => ({
      ...prev,
      [rowIndex]: {
        ...prev[rowIndex],
        cellConfigs: {
          ...prev[rowIndex].cellConfigs,
          [cellIndex]: {
            ...prev[rowIndex].cellConfigs[cellIndex],
            [key]: value,
          },
        },
      },
    }));
  };

  // Build className for a specific row
  const getRowClassName = (rowIndex: number) => {
    const rowConfig = config[rowIndex]?.rowConfig;
    return [rowConfig?.selected && 'ag-row-selected', rowConfig?.hover && 'ag-row-hover'].filter(Boolean).join(' ');
  };

  // Build className for a specific cell
  const getCellClassName = (rowIndex: number, cellIndex: number) => {
    const cellConfig = config[rowIndex]?.cellConfigs[cellIndex];
    return [
      cellIndex === 0 && 'ag-column-first', // First column styling (no left border)
      cellConfig?.focused && 'ag-cell-focus',
      cellConfig?.focusColumn && 'ag-cell-focus-column',
      cellConfig?.edited && 'cell-edited',
      cellConfig?.withGreenDot && 'cell-with-green-dot',
      cellConfig?.withRedDot && 'cell-with-red-dot',
    ]
      .filter(Boolean)
      .join(' ');
  };

  // Handler for cell clicks
  const handleCellClick = (rowIndex: number, cellIndex: number) => {
    setSelectedCell({ row: rowIndex, cell: cellIndex });
  };

  return (
    <MainContent>
      <MainContent.BasicHeader title="Dev tools - Grid playground" />
      <MainContent.Body>
        <Stack w="100%" p="md">
          {/* Display selected cell */}
          <Text size="sm" fw={600} mb="md">
            Selected Cell: Row {selectedCell.row}, Column {selectedCell.cell}
          </Text>

          {/* Control checkboxes for selected cell */}
          <Group gap="xl" mb="md">
            {/* Row config */}
            <Stack gap="sm">
              <Text size="sm" fw={600}>
                Row Config (Row {selectedCell.row})
              </Text>
              <Checkbox
                label="ag-row-selected"
                checked={config[selectedCell.row]?.rowConfig.selected ?? false}
                onChange={(e) => updateRowConfig(selectedCell.row, 'selected', e.currentTarget.checked)}
              />
              <Checkbox
                label="ag-row-hover"
                checked={config[selectedCell.row]?.rowConfig.hover ?? false}
                onChange={(e) => updateRowConfig(selectedCell.row, 'hover', e.currentTarget.checked)}
              />
            </Stack>

            {/* Cell config */}
            <Stack gap="sm">
              <Text size="sm" fw={600}>
                Cell Config (Row {selectedCell.row}, Cell {selectedCell.cell})
              </Text>
              <Checkbox
                label="ag-cell-focus"
                checked={config[selectedCell.row]?.cellConfigs[selectedCell.cell]?.focused ?? false}
                onChange={(e) =>
                  updateCellConfig(selectedCell.row, selectedCell.cell, 'focused', e.currentTarget.checked)
                }
              />
              <Checkbox
                label="ag-cell-focus-column"
                checked={config[selectedCell.row]?.cellConfigs[selectedCell.cell]?.focusColumn ?? false}
                onChange={(e) =>
                  updateCellConfig(selectedCell.row, selectedCell.cell, 'focusColumn', e.currentTarget.checked)
                }
              />
              <Checkbox
                label="cell-edited (blue gradient)"
                checked={config[selectedCell.row]?.cellConfigs[selectedCell.cell]?.edited ?? false}
                onChange={(e) =>
                  updateCellConfig(selectedCell.row, selectedCell.cell, 'edited', e.currentTarget.checked)
                }
              />
              <Checkbox
                label="cell-with-green-dot (green indicator)"
                checked={config[selectedCell.row]?.cellConfigs[selectedCell.cell]?.withGreenDot ?? false}
                onChange={(e) =>
                  updateCellConfig(selectedCell.row, selectedCell.cell, 'withGreenDot', e.currentTarget.checked)
                }
              />
              <Checkbox
                label="cell-with-red-dot (red indicator)"
                checked={config[selectedCell.row]?.cellConfigs[selectedCell.cell]?.withRedDot ?? false}
                onChange={(e) =>
                  updateCellConfig(selectedCell.row, selectedCell.cell, 'withRedDot', e.currentTarget.checked)
                }
              />
            </Stack>
          </Group>

          {/* AG Grid themed container */}
          <div
            className={`${isDarkTheme ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} my-grid`}
            style={{
              width: `${TOTAL_WIDTH}px`,
              minHeight: '60px',
              border: '1px solid var(--ag-border-color)',
              background: isDarkTheme ? 'var(--mantine-color-dark-7)' : 'white',
            }}
          >
            {/* AG Grid root */}
            <div
              className="ag-root ag-unselectable ag-layout-normal"
              style={{ position: 'relative', width: '100%', height: '100%' }}
            >
              {/* AG Grid header */}
              <div className="ag-header ag-pivot-off" role="presentation" style={{ height: '35px', minHeight: '35px' }}>
                <div className="ag-header-viewport" role="presentation">
                  <div className="ag-header-container" role="rowgroup" style={{ width: `${TOTAL_WIDTH}px` }}>
                    <div
                      className="ag-header-row ag-header-row-column"
                      role="row"
                      style={{ top: '0px', height: '35px', width: `${TOTAL_WIDTH}px` }}
                    >
                      {/* ID column header */}
                      <div
                        className="ag-header-cell ag-header-cell-sortable ag-focus-managed"
                        role="columnheader"
                        tabIndex={-1}
                        style={{ width: `${ID_COLUMN_WIDTH}px`, left: '0px' }}
                      >
                        <div className="ag-header-cell-resize" role="presentation"></div>
                        <div className="ag-header-cell-comp-wrapper" role="presentation">
                          <div className="ag-cell-label-container" role="presentation">
                            <div className="ag-header-cell-label" role="presentation">
                              <span className="ag-header-cell-text">ID</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Name column header */}
                      <div
                        className="ag-header-cell ag-header-cell-sortable ag-focus-managed"
                        role="columnheader"
                        tabIndex={-1}
                        style={{ width: `${NAME_COLUMN_WIDTH}px`, left: `${ID_COLUMN_WIDTH}px` }}
                      >
                        <div className="ag-header-cell-resize" role="presentation"></div>
                        <div className="ag-header-cell-comp-wrapper" role="presentation">
                          <div className="ag-cell-label-container" role="presentation">
                            <div className="ag-header-cell-label" role="presentation">
                              <span className="ag-header-cell-text">NAME</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AG Grid body viewport */}
              <div className="ag-body-viewport" style={{ height: '300px', overflow: 'hidden' }}>
                {/* AG Grid center (where rows live) */}
                <div className="ag-center-cols-viewport" style={{ height: '100%' }}>
                  <div className="ag-center-cols-container" style={{ width: `${TOTAL_WIDTH}px`, height: '288px' }}>
                    <GridRow
                      rowIndex={0}
                      rowId="sre_Bl1FX2hhlF"
                      rowClassName={getRowClassName(0)}
                      cell0ClassName={getCellClassName(0, 0)}
                      cell1ClassName={getCellClassName(0, 1)}
                      idColumnWidth={ID_COLUMN_WIDTH}
                      nameColumnWidth={NAME_COLUMN_WIDTH}
                      idValue="1"
                      nameValue="First row"
                      onCellClick={handleCellClick}
                    />
                    <GridRow
                      rowIndex={1}
                      rowId="sre_Bl1FX2hhlG"
                      rowClassName={getRowClassName(1)}
                      cell0ClassName={getCellClassName(1, 0)}
                      cell1ClassName={getCellClassName(1, 1)}
                      idColumnWidth={ID_COLUMN_WIDTH}
                      nameColumnWidth={NAME_COLUMN_WIDTH}
                      idValue="2"
                      nameValue="Second row"
                      onCellClick={handleCellClick}
                    />
                    <GridRow
                      rowIndex={2}
                      rowId="sre_Bl1FX2hhlH"
                      rowClassName={getRowClassName(2)}
                      cell0ClassName={getCellClassName(2, 0)}
                      cell1ClassName={getCellClassName(2, 1)}
                      idColumnWidth={ID_COLUMN_WIDTH}
                      nameColumnWidth={NAME_COLUMN_WIDTH}
                      idValue="3"
                      nameValue="Third row"
                      onCellClick={handleCellClick}
                    />
                    <GridRow
                      rowIndex={3}
                      rowId="sre_Bl1FX2hhlI"
                      rowClassName={getRowClassName(3)}
                      cell0ClassName={getCellClassName(3, 0)}
                      cell1ClassName={getCellClassName(3, 1)}
                      idColumnWidth={ID_COLUMN_WIDTH}
                      nameColumnWidth={NAME_COLUMN_WIDTH}
                      idValue="4"
                      nameValue="Fourth row"
                      onCellClick={handleCellClick}
                    />
                    <GridRow
                      rowIndex={4}
                      rowId="sre_Bl1FX2hhlJ"
                      rowClassName={getRowClassName(4)}
                      cell0ClassName={getCellClassName(4, 0)}
                      cell1ClassName={getCellClassName(4, 1)}
                      idColumnWidth={ID_COLUMN_WIDTH}
                      nameColumnWidth={NAME_COLUMN_WIDTH}
                      idValue="5"
                      nameValue="Fifth row"
                      onCellClick={handleCellClick}
                    />
                    <GridRow
                      rowIndex={5}
                      rowId="sre_Bl1FX2hhlK"
                      rowClassName={getRowClassName(5)}
                      cell0ClassName={getCellClassName(5, 0)}
                      cell1ClassName={getCellClassName(5, 1)}
                      idColumnWidth={ID_COLUMN_WIDTH}
                      nameColumnWidth={NAME_COLUMN_WIDTH}
                      idValue="6"
                      nameValue="Sixth row"
                      onCellClick={handleCellClick}
                    />
                    <GridRow
                      rowIndex={6}
                      rowId="sre_Bl1FX2hhlL"
                      rowClassName={getRowClassName(6)}
                      cell0ClassName={getCellClassName(6, 0)}
                      cell1ClassName={getCellClassName(6, 1)}
                      idColumnWidth={ID_COLUMN_WIDTH}
                      nameColumnWidth={NAME_COLUMN_WIDTH}
                      idValue="7"
                      nameValue="Seventh row"
                      onCellClick={handleCellClick}
                    />
                    <GridRow
                      rowIndex={7}
                      rowId="sre_Bl1FX2hhlM"
                      rowClassName={getRowClassName(7)}
                      cell0ClassName={getCellClassName(7, 0)}
                      cell1ClassName={getCellClassName(7, 1)}
                      idColumnWidth={ID_COLUMN_WIDTH}
                      nameColumnWidth={NAME_COLUMN_WIDTH}
                      idValue="8"
                      nameValue="Eighth row"
                      onCellClick={handleCellClick}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Stack>
      </MainContent.Body>
    </MainContent>
  );
}
