import { TextRegularXs } from '@/app/components/base/text';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { BulkUpdateRecordsDto, RecordOperation } from '@/types/server-entities/records';
import { SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { sleep } from '@/utils/helpers';
import { Box, Group, Loader, Stack } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { useSnapshotContext } from '../../SnapshotContext';
import { DisplayField } from './DisplayField';

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
        if (!hasSuggestion) return;

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
        if (!hasSuggestion) return;

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

      return (
        <DisplayField
          table={table}
          record={currentRecord}
          columnId={field}
          key={field}
          mode={focusedView ? 'focus' : 'normal'}
          updateField={updateField}
          onFieldLabelClick={() => handleFocusOnField(focusedView ? undefined : field)}
          onAcceptSuggestion={handleAcceptSuggestion}
          onRejectSuggestion={handleRejectSuggestion}
          saving={saving}
          currentView={currentView}
        />
      );
    },
    [currentRecord, saving, updateField, acceptCellValues, rejectCellValues, handleFocusOnField, currentView],
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
