import { useSnapshotRecords, useSnapshotViews } from '@/hooks/use-snapshot';
import { snapshotApi } from '@/lib/api/snapshot';
import { RecordOperation } from '@/types/server-entities/records';
import { PostgresColumnType, Snapshot, SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import {
  ActionIcon,
  Anchor,
  Button,
  Center,
  Checkbox,
  Divider,
  Group,
  Loader,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowLeftIcon, ArrowUpIcon, XIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FocusedCell } from './types';

interface RecordViewProps {
  snapshot: Snapshot;
  table: TableSpec;
  initialRecordId?: string;
  initialColumnId?: string;
  onSwitchToSpreadsheetView: () => void;
  onFocusedCellsChange?: (readFocus: FocusedCell[], writeFocus: FocusedCell[]) => void;
}

export const RecordView = ({
  snapshot,
  table,
  initialRecordId,
  initialColumnId,
  onSwitchToSpreadsheetView,
  onFocusedCellsChange,
}: RecordViewProps) => {
  const [currentRecordId, setCurrentRecordId] = useState<string | undefined>(initialRecordId);
  const [currentColumnId, setCurrentColumnId] = useState<string | undefined>(initialColumnId);
  const [showSuggestedOnly, setShowSuggestedOnly] = useState(false);
  const [showEditedOnly, setShowEditedOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  const tableContext = snapshot.tableContexts.find((c) => c.id.wsId === table.id.wsId);

  const { views } = useSnapshotViews({
    snapshotId: snapshot.id,
    tableId: table.id.wsId,
  });

  const activeView = views ? views.find((v) => v.id === tableContext?.activeViewId) : undefined;

  const { recordsResponse, isLoading, error, bulkUpdateRecords } = useSnapshotRecords({
    snapshotId: snapshot.id,
    tableId: table.id.wsId,
    activeView: activeView,
  });

  const records = useMemo(() => {
    if (!recordsResponse?.records) return undefined;
    return recordsResponse.records;
  }, [recordsResponse]);

  const currentRecord = useMemo<SnapshotRecord | undefined>(() => {
    if (!currentRecordId) return undefined;
    return records?.find((r) => r.id.wsId === currentRecordId);
  }, [currentRecordId, records]);

  const focusRecord = useCallback(
    (record: SnapshotRecord, columnId?: string) => {
      const cells = columnId
        ? [{ recordWsId: record.id.wsId, columnWsId: columnId }]
        : Object.keys(record.fields).map((field) => ({ recordWsId: record.id.wsId, columnWsId: field }));

      onFocusedCellsChange?.([], cells);
    },
    [onFocusedCellsChange],
  );

  useEffect(() => {
    if (!currentRecordId && recordsResponse?.records && recordsResponse.records.length > 0) {
      const record = recordsResponse.records[0];
      setCurrentRecordId(record.id.wsId);
      focusRecord(record);
    }
  }, [recordsResponse, currentRecordId, focusRecord]);

  const updateField = useCallback(
    async (field: string, value: string) => {
      if (!currentRecord) return;

      const ops: RecordOperation[] = [
        {
          op: 'update',
          wsId: currentRecord.id.wsId,
          data: { [field]: value },
        },
      ];

      try {
        setSaving(true);
        await bulkUpdateRecords({ ops });
      } catch (e) {
        const error = e as Error;
        notifications.show({
          title: 'Error updating field',
          message: error.message,
          color: 'red',
        });
      } finally {
        setSaving(false);
      }
    },
    [currentRecord, bulkUpdateRecords],
  );

  const handleSelectRecord = (record: SnapshotRecord) => {
    setCurrentRecordId(record.id.wsId);
    focusRecord(record, currentColumnId);
  };

  const handleSelectColumn = useCallback(
    (record: SnapshotRecord, columnId?: string) => {
      setCurrentColumnId(columnId);
      focusRecord(record, columnId);
    },
    [focusRecord, setCurrentColumnId],
  );

  const fieldToInput = useCallback(
    (field: string, table: TableSpec, focusedView?: boolean, hasEditedValue?: boolean) => {
      const column = table.columns.find((c) => c.id.wsId === field);
      if (!column) return null;
      if (!currentRecord) return null;

      const value = currentRecord.fields[field] as string;
      const greenBackgroundStyle = hasEditedValue
        ? {
            input: {
              backgroundColor: '#e0fde0',
            },
          }
        : undefined;

      if (
        column.pgType === PostgresColumnType.JSONB ||
        column.markdown ||
        (column.pgType === PostgresColumnType.TEXT && value && value.length > 200)
      ) {
        if (focusedView) {
          // the text area should try and fill the full height of the parent stack
          return (
            <Textarea
              key={field}
              label={column.name}
              value={value || ''}
              onChange={(e) => updateField(field, e.target.value)}
              minRows={10}
              styles={{
                wrapper: {
                  height: '95%',
                },
                input: {
                  height: '95%',
                  ...greenBackgroundStyle?.input,
                },
              }}
              h="95%"
            />
          );
        } else {
          return (
            <Textarea
              key={field}
              label={column.name}
              value={value || ''}
              onChange={(e) => updateField(field, e.target.value)}
              autosize
              minRows={3}
              maxRows={10}
              readOnly={column.readonly}
              styles={greenBackgroundStyle}
            />
          );
        }
      }

      if (column.pgType === PostgresColumnType.NUMERIC) {
        // this needs to be handled differently
        return (
          <NumberInput
            key={field}
            label={column.name}
            value={currentRecord.fields[field] as number}
            onChange={(value) => updateField(field, value.toString())}
            readOnly={column.readonly}
            styles={greenBackgroundStyle}
          />
        );
      }
      if (column.pgType === PostgresColumnType.BOOLEAN) {
        return (
          <Checkbox
            key={field}
            label={column.name}
            checked={value === 'true'}
            onChange={(e) => updateField(field, e.target.checked.toString())}
            readOnly={column.readonly}
          />
        );
      }

      if (
        column.pgType === PostgresColumnType.TEXT_ARRAY ||
        column.pgType === PostgresColumnType.NUMERIC_ARRAY ||
        column.pgType === PostgresColumnType.BOOLEAN_ARRAY
      ) {
        return (
          <Textarea
            key={field}
            label={column.name}
            value={value ?? ''}
            autosize
            minRows={3}
            maxRows={5}
            readOnly={column.readonly}
            styles={greenBackgroundStyle}
          />
        );
      }

      return (
        <TextInput
          key={field}
          label={column.name}
          value={value ?? ''}
          onChange={(e) => updateField(field, e.target.value)}
          readOnly={column.readonly}
          styles={greenBackgroundStyle}
        />
      );
    },
    [currentRecord, updateField],
  );

  const fieldToInputAndSuggestion = useCallback(
    (field: string, table: TableSpec, focusedView?: boolean) => {
      const column = table.columns.find((c) => c.id.wsId === field);
      if (!column) return null;
      if (!currentRecord) return null;

      const hasSuggestion = !!currentRecord.__suggested_values?.[field];

      const handleAcceptSuggestion = async () => {
        if (!currentRecord) return;

        try {
          setSaving(true);
          await snapshotApi.acceptCellValues(snapshot.id, table.id.wsId, [
            { wsId: currentRecord.id.wsId, columnId: field },
          ]);
          notifications.show({
            title: 'Suggestion Accepted',
            message: `Accepted suggestion for ${column.name}`,
            color: 'green',
          });
          // Refresh the records to get updated state
          // window.location.reload();
        } catch (e) {
          const error = e as Error;
          notifications.show({
            title: 'Error accepting suggestion',
            message: error.message,
            color: 'red',
          });
        } finally {
          setSaving(false);
        }
      };

      const handleRejectSuggestion = async () => {
        if (!currentRecord) return;

        try {
          setSaving(true);
          await snapshotApi.rejectCellValues(snapshot.id, table.id.wsId, [
            { wsId: currentRecord.id.wsId, columnId: field },
          ]);
          notifications.show({
            title: 'Suggestion Rejected',
            message: `Rejected suggestion for ${column.name}`,
            color: 'green',
          });
          // Refresh the records to get updated state
          // window.location.reload();
        } catch (e) {
          const error = e as Error;
          notifications.show({
            title: 'Error rejecting suggestion',
            message: error.message,
            color: 'red',
          });
        } finally {
          setSaving(false);
        }
      };

      const hasEditedValue = !!currentRecord.__edited_fields?.[field];

      return (
        <Stack key={field} gap="xs" h="100%">
          {fieldToInput(field, table, focusedView, hasEditedValue)}
          {hasSuggestion && (
            <>
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
              <Textarea
                value={currentRecord.__suggested_values?.[field] as string}
                disabled
                autosize
                minRows={1}
                maxRows={10}
                styles={{
                  input: {
                    color: '#b8860b',
                    backgroundColor: '#fefefe',
                    borderColor: '#e0e0e0',
                  },
                }}
              />
            </>
          )}
        </Stack>
      );
    },
    [currentRecord, updateField, snapshot.id, table.id.wsId],
  );

  if (error) {
    return (
      <Center h="100%">
        <Text c="red">Error loading records: {error.message}</Text>
      </Center>
    );
  }

  if (isLoading && !recordsResponse) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  }

  let recordContent = null;
  const currentColumn = table.columns.find((c) => c.id.wsId === currentColumnId);

  if (currentRecord && currentColumn) {
    recordContent = fieldToInputAndSuggestion(currentColumn.id.wsId, table, true);
  } else if (currentRecord) {
    // Filter fields based on checkbox states
    const fieldsToShow = Object.keys(currentRecord.fields).filter((fieldName) => {
      const hasSuggestion = currentRecord.__suggested_values?.[fieldName] !== undefined;
      const hasEditedValue = currentRecord.__edited_fields?.[fieldName] !== undefined;

      if (showSuggestedOnly && showEditedOnly) {
        // Both checkboxes checked: show fields that have BOTH suggestion AND edited value
        return hasSuggestion && hasEditedValue;
      } else if (showSuggestedOnly) {
        // Only suggested checkbox checked: show fields with suggestions
        return hasSuggestion;
      } else if (showEditedOnly) {
        // Only edited checkbox checked: show fields with edited values
        return hasEditedValue;
      } else {
        // No checkboxes checked: show all fields
        return true;
      }
    });

    recordContent = (
      <Stack>
        <Group justify="space-between" align="center">
          <Text>Record Details</Text>
          <Group gap="md">
            <Checkbox
              label="Show fields with suggested changes only"
              checked={showSuggestedOnly}
              onChange={(e) => setShowSuggestedOnly(e.target.checked)}
            />
            <Checkbox
              label="Show fields with updated values only"
              checked={showEditedOnly}
              onChange={(e) => setShowEditedOnly(e.target.checked)}
            />
          </Group>
        </Group>
        {fieldsToShow.map((fieldName) => fieldToInputAndSuggestion(fieldName, table, false))}
      </Stack>
    );
  }

  return (
    <Stack h="100%" w="100%" gap={0} p={0}>
      <Group p="xs">
        <ActionIcon variant="subtle" onClick={onSwitchToSpreadsheetView} c="black">
          <ArrowLeftIcon />
        </ActionIcon>
        <Text>Record View</Text>
        {saving && <Loader size="xs" ml="auto" />}
      </Group>
      <Group gap={0} p={0} h="100%">
        <Stack h="100%" w="20%" gap="xs" p="xs">
          {records?.map((record) => (
            <Stack key={record.id.wsId} gap="3px">
              <Anchor
                component="span"
                key={record.id.wsId}
                onClick={() => handleSelectRecord(record)}
                underline="never"
              >
                <Text fw={currentRecordId === record.id.wsId ? 'bold' : 'normal'}>{buildRecordTitle(record)}</Text>
              </Anchor>
              {currentRecordId === record.id.wsId ? (
                <Stack pl="md" gap="2px" h="100%">
                  {table.columns.map((c) => (
                    <Anchor
                      component="span"
                      fz="sm"
                      fw={currentColumnId === c.id.wsId ? 'bold' : 'normal'}
                      key={c.id.wsId}
                      onClick={() => {
                        if (currentColumnId === c.id.wsId) {
                          handleSelectColumn(record, undefined);
                        } else {
                          handleSelectColumn(record, c.id.wsId);
                        }
                      }}
                      underline="never"
                    >
                      {c.name}
                    </Anchor>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          ))}
        </Stack>
        <Divider orientation="vertical" w={10} />
        <Stack h="100%" gap="xs" p="xs" flex={1}>
          {recordContent}
        </Stack>
      </Group>
    </Stack>
  );
};

function buildRecordTitle(record: SnapshotRecord): string {
  if (record.fields) {
    for (const key of Object.keys(record.fields)) {
      if (key.toLowerCase() === 'title' || key.toLowerCase() === 'name') {
        return record.fields[key] as string;
      }
    }
  }
  return record.id.wsId;
}
