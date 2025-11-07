'use client';

import { SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { Box, Paper, ScrollArea } from '@mantine/core';
import { FC, useEffect } from 'react';
import { ActiveCells } from '../../../../../stores/snapshot-editor-store';
import { RecordDetails } from '../record-details/RecordDetails';
import { RecordDetailsHeader } from '../record-details/RecordDetailsHeader';
import { RecordSuggestionToolbar } from '../RecordSuggestionToolbar';

type Props = {
  width: string;
  snapshotId: string;
  selectedRecord: SnapshotRecord;
  activeCells: ActiveCells;
  table: TableSpec;
  handleFieldFocus: (columnId: string | undefined) => void;
  handleCloseRecordDetails: () => void;
  acceptCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  rejectCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  handleRecordUpdate: (recordId: string, field: string, value: string | number | boolean) => void;
  handleRowNavigation: (direction: 'up' | 'down', source: KeyboardEvent | null) => void;
};

export const RecordDetailsOverlay: FC<Props> = (props) => {
  const {
    width,
    selectedRecord,
    activeCells,
    table,
    handleFieldFocus,
    handleCloseRecordDetails,
    acceptCellValues,
    rejectCellValues,
    handleRecordUpdate,
    snapshotId,
    handleRowNavigation,
  } = props;
  const columnsWithSuggestions = Object.keys(selectedRecord?.__suggested_values || {});
  const hasSuggestions =
    columnsWithSuggestions.length > 0 &&
    (!activeCells.columnId || columnsWithSuggestions.includes(activeCells.columnId));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
          // ignore arrow keys in input and textarea
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        handleRowNavigation(event.key === 'ArrowUp' ? 'up' : 'down', event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleRowNavigation]);

  const HEADER_HEIGHT = 36;

  return (
    <Box
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width, // Dynamically calculated width
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
      }}
    >
      <Paper
        style={{
          width: '100%',
          borderRadius: 0,
          height: '100%',
          borderLeft: '1px solid var(--mantine-color-gray-3)',
        }}
      >
        <Box>
          <RecordDetailsHeader
            h={HEADER_HEIGHT}
            table={table}
            columnId={activeCells.columnId}
            onSwitchColumn={handleFieldFocus}
            v2
            onClose={handleCloseRecordDetails}
          />
          <Box p="sm" style={{ position: 'relative', height: '100%' }}>
            <ScrollArea h={hasSuggestions ? `calc(100vh - 190px)` : `calc(100vh - 150px)`} type="hover" scrollbars="y">
              <RecordDetails
                snapshotId={snapshotId}
                currentRecord={selectedRecord}
                table={table}
                currentColumnId={activeCells.columnId}
                acceptCellValues={acceptCellValues}
                rejectCellValues={rejectCellValues}
                onFocusOnField={handleFieldFocus}
                onRecordUpdate={handleRecordUpdate}
              />
            </ScrollArea>
          </Box>
        </Box>
      </Paper>
      {hasSuggestions && (
        <RecordSuggestionToolbar
          record={selectedRecord}
          table={table}
          columnId={activeCells.columnId}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 44,
          }}
        />
      )}
    </Box>
  );
};

export default RecordDetailsOverlay;
