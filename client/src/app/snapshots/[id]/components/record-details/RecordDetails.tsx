import { TextRegularXs } from '@/app/components/base/text';
import { DiffViewer } from '@/app/components/DiffViewer';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { BulkUpdateRecordsDto, RecordOperation } from '@/types/server-entities/records';
import { isLargeTextColumn, isTextColumn, SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { isColumnProtected } from '@/types/server-entities/view';
import { sleep } from '@/utils/helpers';
import { Box, Button, Group, Loader, ScrollArea, Stack, Textarea } from '@mantine/core';
import { ArrowUpIcon, XIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { useSnapshotContext } from '../../SnapshotContext';
import { DisplayField } from './DisplayField';
import { FieldLabel, FieldRow } from './FieldRow';

interface RecordDetailsProps {
  snapshotId: string;
  currentRecord: SnapshotRecord;
  table: TableSpec;
  currentColumnId: string | undefined;
  acceptCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  rejectCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  bulkUpdateRecord: (dto: BulkUpdateRecordsDto) => Promise<void>;
  onFocusOnField?: (columnId: string | undefined) => void;
}

interface PendingUpdate {
  field: string;
  value: string;
}

export const RecordDetails = ({
  currentRecord,
  table,
  currentColumnId,
  acceptCellValues,
  rejectCellValues,
  bulkUpdateRecord,
  onFocusOnField,
}: RecordDetailsProps) => {
  const { currentView } = useSnapshotContext();
  const [saving, setSaving] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);

  const currentColumn = table.columns.find((c) => c.id.wsId === currentColumnId);

  const savePendingUpdates = useCallback(async () => {
    if (pendingUpdates.length === 0) return;
    if (!currentRecord) return;

    const ops: RecordOperation[] = pendingUpdates.map((update) => ({
      op: 'update',
      wsId: currentRecord.id.wsId,
      data: { [update.field]: update.value },
    }));

    try {
      setSaving(true);
      await bulkUpdateRecord({ ops });
      setPendingUpdates([]);
      await sleep(200);
    } catch (e) {
      const error = e as Error;
      ScratchpadNotifications.error({
        title: 'Error updating field',
        message: error.message,
      });
    } finally {
      setSaving(false);
    }
  }, [pendingUpdates, bulkUpdateRecord, currentRecord]);

  // Auto-save pending updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      savePendingUpdates();
    }, 5000);

    return () => clearInterval(interval);
  }, [savePendingUpdates]);

  const updateField = useCallback(
    async (field: string, value: string) => {
      if (!currentRecord) return;

      // Update the local in-memory copy of the record
      currentRecord.fields[field] = value;

      const existing = pendingUpdates.findIndex((update) => update.field === field);
      if (existing !== -1) {
        const newPendingUpdates = [...pendingUpdates];
        newPendingUpdates[existing] = { field, value };
        setPendingUpdates(newPendingUpdates);
      } else {
        setPendingUpdates([...pendingUpdates, { field, value }]);
      }
    },
    [currentRecord, pendingUpdates],
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

        try {
          setSaving(true);
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
          setSaving(false);
        }
      };

      const handleRejectSuggestion = async () => {
        if (!currentRecord) return;

        try {
          setSaving(true);
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
          setSaving(false);
        }
      };

      const hasEditedValue = !!currentRecord.__edited_fields?.[field];
      const currentValue = currentRecord.fields[field] as string;
      const isProtected = currentView && isColumnProtected(table.id.wsId, column.id.wsId, currentView);

      const suggestionButtons = hasSuggestion ? (
        <Group gap="xs" justify="center">
          <Button
            size="xs"
            variant="outline"
            color="red"
            leftSection={<XIcon size={14} />}
            onClick={handleRejectSuggestion}
            loading={saving}
          >
            Reject
          </Button>
          <Button
            size="xs"
            variant="filled"
            color="green"
            leftSection={<ArrowUpIcon size={14} />}
            onClick={handleAcceptSuggestion}
            loading={saving}
          >
            Accept
          </Button>
        </Group>
      ) : null;

      if (hasSuggestion && isTextColumn(column)) {
        if (isLargeTextColumn(column, currentValue)) {
          return (
            <Stack h={focusedView ? '100%' : 'auto'} key={field} gap="2px">
              <FieldLabel fieldName={column.name} hasEditedValue={hasEditedValue} isProtected={isProtected} />
              <ScrollArea mah="100%" w="100%" type="hover" mb="xs">
                <DiffViewer
                  originalValue={currentValue}
                  suggestedValue={currentRecord.__suggested_values?.[field] as string}
                />
              </ScrollArea>
              {suggestionButtons}
            </Stack>
          );
        }
        return (
          <Stack key={field} gap="xs">
            <FieldRow fieldName={column.name} hasEditedValue={hasEditedValue} isProtected={isProtected}>
              <Group flex={1} grow>
                <DiffViewer
                  originalValue={currentValue}
                  suggestedValue={currentRecord.__suggested_values?.[field] as string}
                  p="xs"
                />
              </Group>
            </FieldRow>
            {suggestionButtons}
          </Stack>
        );
      } else if (hasSuggestion) {
        return (
          <Stack key={field} gap="xs" h={focusedView ? '100%' : undefined}>
            <Group gap="xs" align="flex-end" grow>
              <DisplayField
                table={table}
                record={currentRecord}
                columnId={field}
                mode={focusedView ? 'focus' : 'normal'}
                updateField={updateField}
                onFieldLabelClick={() => handleFocusOnField(focusedView ? undefined : field)}
              />
              <Textarea
                label="Suggested change"
                value={currentRecord.__suggested_values?.[field] as string}
                disabled
                autosize
                minRows={1}
                styles={{
                  input: {
                    color: '#b8860b',
                    backgroundColor: '#fefefe',
                    borderColor: '#e0e0e0',
                  },
                }}
              />
            </Group>
            {suggestionButtons}
          </Stack>
        );
      }

      return (
        <Stack key={field} gap="xs" h={focusedView ? '100%' : undefined}>
          <DisplayField
            table={table}
            record={currentRecord}
            columnId={field}
            mode={focusedView ? 'focus' : 'normal'}
            updateField={updateField}
            onFieldLabelClick={() => handleFocusOnField(focusedView ? undefined : field)}
          />
        </Stack>
      );
    },
    [currentRecord, currentView, saving, updateField, acceptCellValues, rejectCellValues, handleFocusOnField],
  );

  if (currentRecord && currentColumn) {
    // just show the current active column
    content = fieldToInputAndSuggestion(currentColumn.id.wsId, table, true);
  } else if (currentRecord) {
    const fieldsToShow = Object.keys(currentRecord.fields);
    content = fieldsToShow.map((fieldName) => fieldToInputAndSuggestion(fieldName, table, false));
  }

  return (
    <Stack p={0}>
      <Box style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 10 }}>
        {saving && (
          <Group gap="xs">
            <Loader c="blue.6" size="xs" />
            <TextRegularXs>Saving...</TextRegularXs>
          </Group>
        )}
      </Box>
      {content}
    </Stack>
  );
};
