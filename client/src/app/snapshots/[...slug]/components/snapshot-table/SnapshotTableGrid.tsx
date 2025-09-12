'use client';

import { DataEditor } from '@glideapps/glide-data-grid';
import { ActionIcon, Box, Center, Loader, Stack, Text, Tooltip } from '@mantine/core';
import { PlusIcon } from '@phosphor-icons/react';
import { SnapshotTableGridProps } from '../types';
import { FocusedCellsDebugModal } from './FocusedCellsDebugModal';
import { ContextMenu } from './menus/ContextMenu';
import { HeaderMenu } from './menus/HeaderMenu';
import { SnapshotTableGridProvider, useSnapshotTableGridContext } from './SnapshotTableGridProvider';
import { useDrawCell } from './useDrawCell';

export const SnapshotTableGridInternal = () => {
  const {
    coreGridState,
    coreGridHandlers,
    error,
    isLoading,
    sortedRecords,
    columns,
    currentSelection,
    getCellContent,
    onCellEdited,
    onHeaderClicked,
    onHeaderMenuClick,
    onCellClicked,
    onCellContextMenu,
    handleKeyDown,
    onAddRow,
  } = useSnapshotTableGridContext();

  const drawCell = useDrawCell();

  if (error) {
    return (
      <Center h="100%">
        <Text c="red">Error loading records: {error.message}</Text>
      </Center>
    );
  }

  if (isLoading && !sortedRecords) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <FocusedCellsDebugModal />
      <Box
        h="100%"
        w="100%"
        style={{ position: 'relative' }}
        onClick={() => {
          // Close menus when clicking outside
        }}
      >
        <Stack p={0} h="100%" gap={0}>
          <DataEditor
            // Layout
            width="100%"
            height="100%"
            columns={columns}
            rows={sortedRecords?.length ?? 0}
            // Core grid state
            gridSelection={currentSelection}
            onGridSelectionChange={coreGridState.setCurrentSelection}
            // Cell rendering
            getCellContent={getCellContent}
            onCellEdited={onCellEdited}
            // Event handlers
            onColumnResize={coreGridHandlers.onColumnResize}
            onHeaderClicked={onHeaderClicked}
            onHeaderMenuClick={onHeaderMenuClick}
            onCellClicked={onCellClicked}
            onCellContextMenu={onCellContextMenu}
            onKeyDown={handleKeyDown}
            onMouseMove={(e) => {
              if (e.kind === 'cell') {
                coreGridState.setHoveredRow(e.location[1]);
              }
            }}
            theme={{
              headerIconSize: 24,
              bgHeader: '#f8f9fa',
              textHeader: '#333',
            }}
            drawCell={drawCell}
            data-grid-container // Add this attribute to the grid container
          />
          <Box
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              zIndex: 10,
            }}
          >
            <Tooltip label="Add record">
              <ActionIcon onClick={onAddRow} size="xl" radius="xl" variant="filled">
                <PlusIcon size={24} strokeWidth="bold" />
              </ActionIcon>
            </Tooltip>
          </Box>
        </Stack>
      </Box>

      <ContextMenu />
      <HeaderMenu />
    </>
  );
};

const SnapshotTableGrid = ({ snapshot, table }: SnapshotTableGridProps) => {
  return (
    <SnapshotTableGridProvider snapshot={snapshot} table={table}>
      <SnapshotTableGridInternal />
    </SnapshotTableGridProvider>
  );
};

export default SnapshotTableGrid;
