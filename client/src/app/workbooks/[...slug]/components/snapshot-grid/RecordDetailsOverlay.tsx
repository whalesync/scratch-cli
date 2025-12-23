'use client';

import { Text13Regular } from '@/app/components/base/text';
import { TextAreaRef } from '@/app/components/EnhancedTextArea';
import { isSideBySideMode } from '@/app/workbooks/[...slug]/components/helpers';
import { RECORD_DETILE_SIDEBAR_W } from '@/app/workbooks/[...slug]/components/record-details/record-detail-constants';
import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { formatFieldValue } from '@/types/server-entities/workbook';
import { Box, Center, Divider, Group, Paper, ScrollArea, Stack } from '@mantine/core';
import { SnapshotTable, TableSpec, WorkbookId } from '@spinner/shared-types';
import { FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActiveCells } from '../../../../../stores/workbook-editor-store';
import { useUpdateRecordsContext } from '../contexts/update-records-context';
import { DisplayField, FocusableElement } from '../record-details/DisplayField';
import { HtmlActionButtons } from '../record-details/HtmlActionButtons';
import { RecordDetails } from '../record-details/RecordDetails';
import { RecordDetailsHeader } from '../record-details/RecordDetailsHeader';
import { RECORD_SUGGESTION_TOOLBAR_HEIGHT, RecordSuggestionToolbar } from '../RecordSuggestionToolbar';
import { RecordDetailsMode } from '../types';

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

  const { addPendingChange } = useUpdateRecordsContext();
  const [mode, setMode] = useState<RecordDetailsMode>('default');
  // Ref to the focusable input element in the current field
  const focusTargetRef = useRef<FocusableElement | null>(null);
  // Local state for UI-only transformations of suggestion values (e.g., prettify/minify HTML)
  const [transformedSuggestionValue, setTransformedSuggestionValue] = useState<string | null>(null);

  // Callback ref to handle both TextAreaRef and HTMLInputElement
  const setFocusTargetRef = useCallback((element: FocusableElement | null) => {
    focusTargetRef.current = element;
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev: RecordDetailsMode) => (isSideBySideMode(prev) ? 'default' : 'sideBySide'));
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

  // Get current column and check if it's HTML
  const tableSpec = table.tableSpec as TableSpec;
  const currentColumn = useMemo(
    () => tableSpec.columns.find((c) => c.id.wsId === activeCells.columnId),
    [tableSpec.columns, activeCells.columnId],
  );
  const isHtmlColumn = currentColumn?.metadata?.textFormat === 'html';

  // Get current and suggested HTML values
  const currentHtmlValue = useMemo(
    () =>
      activeCells.columnId && selectedRecord && currentColumn
        ? formatFieldValue(selectedRecord.fields[activeCells.columnId], currentColumn)
        : '',
    [activeCells.columnId, selectedRecord, currentColumn],
  );

  const suggestedHtmlValue = useMemo(
    () =>
      activeCells.columnId && selectedRecord?.__suggested_values?.[activeCells.columnId] && currentColumn
        ? formatFieldValue(selectedRecord.__suggested_values[activeCells.columnId], currentColumn)
        : '',
    [activeCells.columnId, selectedRecord, currentColumn],
  );

  // Create a modified record with transformed suggestion value for accept/reject to work correctly
  const recordWithTransformedSuggestion = useMemo(() => {
    if (!transformedSuggestionValue || !activeCells.columnId) {
      return selectedRecord;
    }
    return {
      ...selectedRecord,
      __suggested_values: {
        ...selectedRecord.__suggested_values,
        [activeCells.columnId]: transformedSuggestionValue,
      },
    };
  }, [selectedRecord, transformedSuggestionValue, activeCells.columnId]);

  // Focus the input when the overlay opens or column changes
  useLayoutEffect(() => {
    focusInput();
  }, [activeCells.columnId, focusInput]);

  // Reset transformed suggestion value when column or record changes
  useEffect(() => {
    setTransformedSuggestionValue(null);
  }, [activeCells.columnId, selectedRecord.id.wsId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Enter key to focus the input field
      if (event.key === 'Enter') {
        // If already focused on the input, do nothing
        if (document.activeElement === focusTargetRef.current) {
          return;
        }

        const target = event.target as HTMLElement;
        const isInEditableArea =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.isContentEditable ||
          target.closest('.cm-content, .cm-editor, [contenteditable="true"]') !== null;

        // Don't focus if already in an editable area (including CodeMirror)
        if (isInEditableArea) {
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

        const target = event.target as HTMLElement;
        const isInEditableArea =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.isContentEditable ||
          target.closest('.cm-content, .cm-editor, [contenteditable="true"]') !== null;

        // If in an editable area, just blur it (arrows will now navigate fields/rows)
        if (isInEditableArea) {
          target.blur();
          return;
        }

        // If not in an editable area, close the overlay
        handleCloseRecordDetails();
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const target = event.target as HTMLElement;
        const isInEditableArea =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.isContentEditable ||
          target.closest('.cm-content, .cm-editor, [contenteditable="true"]') !== null;

        if (isInEditableArea) {
          // ignore arrow keys when in any editable area (including CodeMirror)
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
              mode={mode}
              onToggleMode={toggleMode}
              table={table.tableSpec}
              columnId={activeCells.columnId}
              onSwitchColumn={handleFieldFocus}
              onClose={handleCloseRecordDetails}
              hiddenColumns={table.hiddenColumns}
              record={selectedRecord}
              onUpdateField={(columnId, value) => {
                handleRecordUpdate(selectedRecord.id.wsId, columnId, value);
                addPendingChange({
                  workbookId,
                  tableId: table.id,
                  operation: {
                    op: 'update',
                    wsId: selectedRecord.id.wsId,
                    data: { [columnId]: value },
                  },
                });
              }}
            />
            {isSideBySideMode(mode) ? (
              <Group gap={4} justify="space-around" flex={1} p={0} style={{ position: 'relative' }}>
                <Stack flex={1}>
                  <Group
                    h={HEADER_HEIGHT}
                    style={{ borderBottom: '0.5px solid var(--fg-divider)', position: 'relative' }}
                    align="center"
                    gap={0}
                    px="xs"
                  >
                    {/* Centered text */}
                    <Center pos="absolute" left={0} right={0} c="var(--fg-secondary)">
                      <Text13Regular>Before</Text13Regular>
                    </Center>
                    {/* Buttons on the right */}
                    {isHtmlColumn && activeCells.columnId && (
                      <Box style={{ position: 'absolute', right: 4, zIndex: 1 }}>
                        <HtmlActionButtons
                          value={currentHtmlValue}
                          onUpdate={(value) => {
                            if (activeCells.columnId) {
                              handleRecordUpdate(selectedRecord.id.wsId, activeCells.columnId, value);
                              addPendingChange({
                                workbookId,
                                tableId: table.id,
                                operation: {
                                  op: 'update',
                                  wsId: selectedRecord.id.wsId,
                                  data: { [activeCells.columnId]: value },
                                },
                              });
                            }
                          }}
                          disabled={currentColumn?.readonly}
                        />
                      </Box>
                    )}
                  </Group>

                  <ScrollArea
                    // NOTE: This calc seems nutty.
                    h={`calc(100vh - 210px)`}
                    type="hover"
                    scrollbars="y"
                  >
                    <DisplayField
                      table={table.tableSpec}
                      record={selectedRecord}
                      columnId={activeCells.columnId ?? ''}
                      key={activeCells.columnId}
                      mode={activeCells.columnId ? 'single' : 'multiple'}
                      updateField={(columnId, value) => handleRecordUpdate(selectedRecord.id.wsId, columnId, value)}
                      onFieldLabelClick={() =>
                        handleFieldFocus(activeCells.columnId ? undefined : activeCells.columnId)
                      }
                      onAcceptSuggestion={() => {}}
                      onRejectSuggestion={() => {}}
                      saving={false}
                      removeSuggestion={true}
                      focusTargetRef={setFocusTargetRef}
                    />
                  </ScrollArea>
                </Stack>

                <Divider orientation="vertical" top={0} bottom={0} pos="absolute" />
                <Stack flex={1}>
                  <Group
                    h={HEADER_HEIGHT}
                    style={{ borderBottom: '0.5px solid var(--fg-divider)', position: 'relative' }}
                    align="center"
                    gap={0}
                    px="xs"
                  >
                    {/* Centered text */}
                    <Center pos="absolute" left={0} right={0} c="var(--fg-secondary)">
                      <Text13Regular>After</Text13Regular>
                    </Center>
                    {/* Buttons on the right */}
                    {isHtmlColumn && activeCells.columnId && (
                      <Box style={{ position: 'absolute', right: 4, zIndex: 1 }}>
                        <HtmlActionButtons
                          value={transformedSuggestionValue ?? suggestedHtmlValue}
                          onUpdate={(value) => {
                            // UI-only transformation - doesn't save to backend
                            setTransformedSuggestionValue(value);
                          }}
                          disabled={currentColumn?.readonly}
                        />
                      </Box>
                    )}
                  </Group>
                  <ScrollArea
                    // NOTE: This calc seems nutty.
                    h={`calc(100vh - 210px)`}
                    type="hover"
                    scrollbars="y"
                  >
                    <DisplayField
                      table={table.tableSpec}
                      record={{
                        ...selectedRecord,
                        fields: {
                          ...selectedRecord.fields,
                          [activeCells.columnId ?? '']:
                            transformedSuggestionValue ??
                            selectedRecord.__suggested_values?.[activeCells.columnId ?? ''],
                        },
                      }}
                      columnId={activeCells.columnId ?? ''}
                      key={activeCells.columnId}
                      mode={activeCells.columnId ? 'single' : 'multiple'}
                      updateField={(columnId, value) => handleRecordUpdate(selectedRecord.id.wsId, columnId, value)}
                      onFieldLabelClick={() =>
                        handleFieldFocus(activeCells.columnId ? undefined : activeCells.columnId)
                      }
                      onAcceptSuggestion={() => {}}
                      onRejectSuggestion={() => {}}
                      saving={false}
                      removeSuggestion={true}
                      focusTargetRef={setFocusTargetRef}
                    />
                  </ScrollArea>
                </Stack>
              </Group>
            ) : (
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
            )}
          </Box>
        </Group>
      </Paper>
      {hasSuggestions && (
        <RecordSuggestionToolbar
          record={recordWithTransformedSuggestion}
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
