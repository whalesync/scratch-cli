import { TextRegularXs } from '@/app/components/base/text';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { Box, Group, Loader, Stack } from '@mantine/core';
import { useCallback, useState } from 'react';
import { useSnapshotContext } from '../contexts/SnapshotContext';
import { useTableContext } from '../contexts/table-context';
import { DisplayField } from './DisplayField';

interface RecordDetailsProps {
  snapshotId: string;
  currentRecord: SnapshotRecord;
  table: TableSpec;
  currentColumnId: string | undefined;
  acceptCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  rejectCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  onFocusOnField?: (columnId: string | undefined) => void;
}

export const RecordDetails = ({
  currentRecord,
  table,
  currentColumnId,
  acceptCellValues,
  rejectCellValues,
  onFocusOnField,
}: RecordDetailsProps) => {
  const { currentView } = useSnapshotContext();
  const { addPendingChange, savingPendingChanges } = useTableContext();
  const [savingSuggestions, setSavingSuggestions] = useState(false);

  const currentColumn = table.columns.find((c) => c.id.wsId === currentColumnId);

  const updateField = useCallback(
    async (field: string, value: string) => {
      if (!currentRecord) return;

      // Update the local in-memory copy of the record
      currentRecord.fields[field] = value;
      addPendingChange({ recordWsId: currentRecord.id.wsId, field, value });
    },
    [currentRecord, addPendingChange],
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
          currentView={currentView}
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
      currentView,
    ],
  );

  if (currentRecord && currentColumn) {
    // just show the current active column
    content = fieldToInputAndSuggestion(currentColumn.id.wsId, table, true);
  } else if (currentRecord) {
    const fieldsToShow = Object.keys(currentRecord.fields);
    content = (
      <Stack p="3rem" gap="xs">
        {fieldsToShow.map((fieldName) => fieldToInputAndSuggestion(fieldName, table, false))}
      </Stack>
    );
  }

  return (
    <Stack p={0}>
      <Box style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 10 }}>
        {savingSuggestions ||
          (savingPendingChanges && (
            <Group gap="xs">
              <Loader c="blue.6" size="xs" />
              <TextRegularXs>Saving...</TextRegularXs>
            </Group>
          ))}
      </Box>
      {content}
    </Stack>
  );
};
