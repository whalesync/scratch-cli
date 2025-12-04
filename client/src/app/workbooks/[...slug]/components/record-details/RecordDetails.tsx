import { Text12Regular } from '@/app/components/base/text';
import { TextAreaRef } from '@/app/components/EnhancedTextArea';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { SnapshotTable, TableSpec } from '@/types/server-entities/workbook';
import { Box, Group, Loader, Stack } from '@mantine/core';
import { WorkbookId } from '@spinner/shared-types';
import { FC, RefObject, useCallback, useMemo, useState } from 'react';
import { useUpdateRecordsContext } from '../contexts/update-records-context';
import { getGridOrderedColumnSpecs } from '../snapshot-grid/header-column-utils';
import { DisplayField } from './DisplayField';

interface RecordDetailsProps {
  workbookId: WorkbookId;
  currentRecord: ProcessedSnapshotRecord;
  table: SnapshotTable;
  currentColumnId: string | undefined;
  acceptCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  rejectCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  onFocusOnField?: (columnId: string | undefined) => void;
  onRecordUpdate?: (recordId: string, field: string, value: string | number | boolean) => void;
  focusTargetRef?: RefObject<TextAreaRef | null>;
}

export const RecordDetails: FC<RecordDetailsProps> = (props) => {
  const {
    workbookId,
    currentRecord,
    table,
    currentColumnId,
    acceptCellValues,
    rejectCellValues,
    onFocusOnField,
    onRecordUpdate,
    focusTargetRef,
  } = props;
  const { addPendingChange, savingPendingChanges } = useUpdateRecordsContext();
  const [savingSuggestions, setSavingSuggestions] = useState(false);

  const tableSpec = table.tableSpec as TableSpec;
  const tableId = table.id;

  const currentColumn = tableSpec.columns.find((c) => c.id.wsId === currentColumnId);
  const orderedColumns = useMemo(
    () => getGridOrderedColumnSpecs(tableSpec, table.hiddenColumns).columns,
    [tableSpec, table.hiddenColumns],
  );

  const updateField = useCallback(
    async (field: string, value: string | number | boolean) => {
      if (!currentRecord) return;

      // Notify parent in case it has processing to do.
      if (onRecordUpdate) {
        onRecordUpdate(currentRecord.id.wsId, field, value);
      }
      // Add the change to the context to be flushed later, also updates the cache optimistically.
      addPendingChange({
        workbookId,
        tableId: tableId,
        operation: {
          op: 'update',
          wsId: currentRecord.id.wsId,
          data: { [field]: value },
        },
      });
    },
    [currentRecord, onRecordUpdate, addPendingChange, workbookId, tableId],
  );
  const handleFocusOnField = useCallback(
    (columnId: string | undefined) => {
      onFocusOnField?.(columnId);
    },
    [onFocusOnField],
  );

  let content = null;

  const fieldToInputAndSuggestion = useCallback(
    (field: string, table: TableSpec, focusedView: boolean) => {
      const column = table.columns.find((c) => c.id.wsId === field);
      if (!column) return null;
      if (!currentRecord) return null;

      const hasSuggestion = !!currentRecord.__suggested_values?.[field];

      const handleAcceptSuggestion = async () => {
        if (!currentRecord) return;
        if (!hasSuggestion) return;

        try {
          setSavingSuggestions(true);
          await acceptCellValues([{ wsId: currentRecord.id.wsId, columnId: field }]);
          ScratchpadNotifications.success({
            title: 'Suggestion Accepted',
            message: `Accepted suggestion for ${column.name}`,
          });
          // Refresh the records to get updated state
          // window.location.reload();
        } catch (e) {
          const error = e as Error;
          ScratchpadNotifications.error({
            title: 'Error accepting suggestion',
            message: error ? (error as Error).message : 'Unknown error',
          });
        } finally {
          setSavingSuggestions(false);
        }
      };

      const handleRejectSuggestion = async () => {
        if (!currentRecord) return;
        if (!hasSuggestion) return;

        try {
          setSavingSuggestions(true);
          await rejectCellValues([{ wsId: currentRecord.id.wsId, columnId: field }]);
          ScratchpadNotifications.success({
            title: 'Suggestion Rejected',
            message: `Rejected suggestion for ${column.name}`,
          });
          // Refresh the records to get updated state
          // window.location.reload();
        } catch (e) {
          const error = e as Error;
          ScratchpadNotifications.error({
            title: 'Error rejecting suggestion',
            message: error.message,
          });
        } finally {
          setSavingSuggestions(false);
        }
      };

      const saving = savingSuggestions || savingPendingChanges;
      return (
        <DisplayField
          table={table}
          record={currentRecord}
          columnId={field}
          key={field}
          mode={focusedView ? 'single' : 'multiple'}
          updateField={updateField}
          onFieldLabelClick={() => handleFocusOnField(focusedView ? undefined : field)}
          onAcceptSuggestion={handleAcceptSuggestion}
          onRejectSuggestion={handleRejectSuggestion}
          saving={saving}
          focusTargetRef={focusedView ? focusTargetRef : undefined}
        />
      );
    },
    [
      currentRecord,
      savingSuggestions,
      savingPendingChanges,
      updateField,
      acceptCellValues,
      rejectCellValues,
      handleFocusOnField,
      focusTargetRef,
    ],
  );

  if (currentRecord && currentColumn) {
    // just show the current active column
    content = fieldToInputAndSuggestion(currentColumn.id.wsId, tableSpec, true);
  } else if (currentRecord) {
    const fieldsToShow = orderedColumns.map((column) => column.id.wsId);
    content = (
      <Stack gap={0}>{fieldsToShow.map((fieldName) => fieldToInputAndSuggestion(fieldName, tableSpec, false))}</Stack>
    );
  }

  return (
    <Stack p={0}>
      <Box style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 10 }}>
        {savingSuggestions ||
          (savingPendingChanges && (
            <Group gap="xs">
              <Loader c="primary" size="xs" />
              <Text12Regular>Saving...</Text12Regular>
            </Group>
          ))}
      </Box>
      {content}
    </Stack>
  );
};
