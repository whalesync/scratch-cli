'use client';

import { SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { Box, Paper, ScrollArea } from '@mantine/core';
import { FC } from 'react';
import { ActiveRecord } from '../contexts/table-context';
import { RecordDetails } from '../record-details/RecordDetails';
import { RecordDetailsHeader } from '../record-details/RecordDetailsHeader';
import { RecordSuggestionToolbar } from '../RecordSuggestionToolbar';

type Props = {
  width: string;
  snapshotId: string;
  selectedRecord: SnapshotRecord;
  activeRecord: ActiveRecord;
  table: TableSpec;
  handleFieldFocus: (columnId: string | undefined) => void;
  handleCloseRecordDetails: () => void;
  acceptCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  rejectCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  handleRecordUpdate: (recordId: string, field: string, value: string) => void;
};

export const RecordDetailsOverlay: FC<Props> = (props) => {
  const {
    width,
    selectedRecord,
    activeRecord,
    table,
    handleFieldFocus,
    handleCloseRecordDetails,
    acceptCellValues,
    rejectCellValues,
    handleRecordUpdate,
    snapshotId,
  } = props;
  const columnsWithSuggestions = Object.keys(selectedRecord?.__suggested_values || {});
  const hasSuggestions =
    columnsWithSuggestions.length > 0 &&
    (!activeRecord.columnId || columnsWithSuggestions.includes(activeRecord.columnId));

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
            columnId={activeRecord.columnId}
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
                currentColumnId={activeRecord.columnId}
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
          columnId={activeRecord.columnId}
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
