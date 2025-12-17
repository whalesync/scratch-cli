'use client';

import { TextAreaRef } from '@/app/components/EnhancedTextArea';
import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { Box, Divider, Group, Paper, ScrollArea } from '@mantine/core';
import { WorkbookId } from '@spinner/shared-types';
import { FC, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { ActiveCells } from '../../../../../stores/workbook-editor-store';
import { FocusableElement } from '../record-details/DisplayField';
import { RECORD_DETILE_SIDEBAR_W } from '../record-details/record-detail-constants';
import { RecordDetails } from '../record-details/RecordDetails';
import { RecordDetailsHeader } from '../record-details/RecordDetailsHeader';
import { RECORD_SUGGESTION_TOOLBAR_HEIGHT, RecordSuggestionToolbar } from '../RecordSuggestionToolbar';

type Props = {
  width: string;
  workbookId: WorkbookId;
  selectedRecord: ProcessedSnapshotRecord;
  activeCells: ActiveCells;
  table: SnapshotTable;
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
    workbookId,
    handleRowNavigation,
  } = props;

  // Ref to the focusable input element in the current field
  const focusTargetRef = useRef<FocusableElement | null>(null);

  // Callback ref to handle both TextAreaRef and HTMLInputElement
  const setFocusTargetRef = useCallback((element: FocusableElement | null) => {
    focusTargetRef.current = element;
  }, []);

  // Helper function to focus the input and position cursor at the end
  const focusInput = useCallback(() => {
    const ref = focusTargetRef.current;
    if (!ref) return;

    // Check if it's a TextAreaRef (has custom focus method)
    if ('focus' in ref && typeof ref.focus === 'function' && 'getCursorPosition' in ref) {
      // It's a TextAreaRef - use its focus method which positions cursor at end
      (ref as TextAreaRef).focus();
    } else if (ref instanceof HTMLInputElement) {
      // It's a standard input - focus and position cursor at end
      ref.focus();
      const length = ref.value.length;
      ref.setSelectionRange(length, length);
    }
  }, []);

  const columnsWithSuggestions = Object.keys(selectedRecord?.__suggested_values || {});
  const hasSuggestions =
    columnsWithSuggestions.length > 0 &&
    (!activeCells.columnId || columnsWithSuggestions.includes(activeCells.columnId));

  // Focus the input when the overlay opens or column changes
  useLayoutEffect(() => {
    focusInput();
  }, [activeCells.columnId, focusInput]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Enter key to focus the input field
      if (event.key === 'Enter') {
        // If already focused on the input, do nothing
        if (document.activeElement === focusTargetRef.current) {
          return;
        }
        // Don't focus if already in an input/textarea
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        focusInput();
        return;
      }

      // Handle Escape key: first blur input, then close overlay
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();

        // If input is focused, just blur it (arrows will now navigate fields/rows)
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
          (event.target as HTMLElement).blur();
          return;
        }

        // If input is not focused, close the overlay
        handleCloseRecordDetails();
        return;
      }

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
  }, [handleRowNavigation, handleCloseRecordDetails, focusInput]);

  const HEADER_HEIGHT = 36;

  return (
    <Box
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width, // Dynamically calculated width
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        borderLeft: '0.5px solid var(--fg-divider)',
        backgroundColor: 'var(--bg-base)',
      }}
    >
      <Paper w="100%" h={hasSuggestions ? `calc(100% - ${RECORD_SUGGESTION_TOOLBAR_HEIGHT}px)` : `100%`} bdrs={0}>
        <Group gap={0} w="100%" align="stretch" h="100%">
          <Box w={6} bg="var(--bg-panel)" />
          <Box flex={1} style={{ borderLeft: '0.5px solid var(--fg-divider)' }}>
            <RecordDetailsHeader
              h={HEADER_HEIGHT}
              table={table.tableSpec}
              columnId={activeCells.columnId}
              onSwitchColumn={handleFieldFocus}
              onClose={handleCloseRecordDetails}
              hiddenColumns={table.hiddenColumns}
              record={selectedRecord}
            />

            <Box p={0} style={{ position: 'relative' }}>
              {selectedRecord && !activeCells.columnId && (
                <Divider orientation="vertical" left={RECORD_DETILE_SIDEBAR_W} top={0} bottom={0} pos="absolute" />
              )}
              <ScrollArea
                // NOTE: This calc seems nutty.
                h={hasSuggestions ? `calc(100vh - 190px)` : `calc(100vh - 150px)`}
                type="hover"
                scrollbars="y"
              >
                <RecordDetails
                  workbookId={workbookId}
                  currentRecord={selectedRecord}
                  table={table}
                  currentColumnId={activeCells.columnId}
                  acceptCellValues={acceptCellValues}
                  rejectCellValues={rejectCellValues}
                  onFocusOnField={handleFieldFocus}
                  onRecordUpdate={handleRecordUpdate}
                  focusTargetRef={setFocusTargetRef}
                />
              </ScrollArea>
            </Box>
          </Box>
        </Group>
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
          }}
        />
      )}
    </Box>
  );
};

export default RecordDetailsOverlay;
