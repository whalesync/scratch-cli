import { useSnapshotRecords, useSnapshotViews } from '@/hooks/use-snapshot';
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
  Modal,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useDisclosure, useSetState } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import MDEditor from '@uiw/react-md-editor';
import _ from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface RecordViewProps {
  snapshot: Snapshot;
  table: TableSpec;
  initialRecordId?: string;
  initialColumnId?: string;
  onSwitchToSpreadsheetView: () => void;
}

export const RecordView = ({
  snapshot,
  table,
  initialRecordId,
  initialColumnId,
  onSwitchToSpreadsheetView,
}: RecordViewProps) => {
  const [currentRecordId, setCurrentRecordId] = useState<string | undefined>(initialRecordId);
  const [currentColumnId, setCurrentColumnId] = useState<string | undefined>(initialColumnId);
  const [draftRecord, setDraftRecord] = useState<SnapshotRecord | undefined>(undefined);
  const [recordDirty, setRecordDirty] = useState(false);
  const [unsavedChangesModalOpened, { open: openUnsavedChangesModal, close: closeUnsavedChangesModal }] =
    useDisclosure(false);
  const [afterModalAction, setAfterModalAction] = useSetState<{
    action: 'switchToRecord' | 'exitView' | null;
    switchToRecord: SnapshotRecord | null;
  }>({
    action: null,
    switchToRecord: null,
  });

  const tableContext = snapshot.tableContexts.find((c) => c.id.wsId === table.id.wsId);

  const { views } = useSnapshotViews({
    snapshotId: snapshot.id,
    tableId: table.id.wsId,
  });

  const activeView = views ? views.find((v) => v.id === tableContext?.activeViewId) : undefined;

  const { recordsResponse, isLoading, error } = useSnapshotRecords({
    snapshotId: snapshot.id,
    tableId: table.id.wsId,
    activeView: activeView,
  });

  const records = useMemo(() => {
    if (!recordsResponse?.records) return undefined;
    return recordsResponse.records;
  }, [recordsResponse]);

  useEffect(() => {
    if (!currentRecordId && recordsResponse?.records && recordsResponse.records.length > 0) {
      setCurrentRecordId(recordsResponse.records[0].id.wsId);
    }
  }, [recordsResponse, currentRecordId]);

  useEffect(() => {
    if (currentRecordId && records && !draftRecord) {
      const rec = records.find((r) => r.id.wsId === currentRecordId);
      if (rec) {
        setDraftRecord(_.cloneDeep(rec));
      }
    }
  }, [currentRecordId, records, draftRecord]);

  const handleSelectRecord = (record: SnapshotRecord) => {
    if (recordDirty) {
      setAfterModalAction({ action: 'switchToRecord', switchToRecord: record });
      openUnsavedChangesModal();
      return;
    }
    setCurrentRecordId(record.id.wsId);
    setDraftRecord(_.cloneDeep(record));
    setRecordDirty(false);
  };

  const saveDraftRecord = useCallback(async () => {
    if (!draftRecord || !recordDirty) return;

    notifications.show({
      title: 'Save not implemented yet',
      message: `Chris is still working on this`,
      color: 'yellow',
    });
  }, [draftRecord]);

  const updateDraftField = useCallback(
    (field: string, value: string) => {
      if (!draftRecord) return;
      setDraftRecord({ ...draftRecord, fields: { ...draftRecord.fields, [field]: value } });
      setRecordDirty(true);
    },
    [draftRecord, setDraftRecord, setRecordDirty],
  );

  const fieldToInput = useCallback(
    (field: string, table: TableSpec, focusedView?: boolean) => {
      const column = table.columns.find((c) => c.id.wsId === field);
      if (!column) return null;
      if (!draftRecord) return null;

      const value = draftRecord.fields[field] as string;

      if (focusedView) {
        if (column.pgType === PostgresColumnType.TEXT && column.markdown) {
          return (
            <>
              <Text>{column.name}</Text>
              <MDEditor
                value={value || ''}
                onChange={(value) => {
                  updateDraftField(field, value || '');
                }}
                preview="edit"
              />
            </>
          );
        }

        if (
          column.pgType === PostgresColumnType.JSONB ||
          (column.pgType === PostgresColumnType.TEXT && value && value.length > 100)
        ) {
          return (
            <Textarea
              key={field}
              label={column.name}
              value={value}
              onChange={(e) => updateDraftField(field, e.target.value)}
              autosize
              minRows={10}
            />
          );
        }
      } else {
        if (column.pgType === PostgresColumnType.TEXT && column.markdown) {
          return (
            <Textarea
              key={field}
              label={column.name}
              value={value}
              onChange={(e) => updateDraftField(field, e.target.value)}
              autosize
              minRows={3}
              maxRows={5}
              readOnly={column.readonly}
            />
          );
        }

        if (
          column.pgType === PostgresColumnType.JSONB ||
          (column.pgType === PostgresColumnType.TEXT && value && value.length > 100)
        ) {
          return (
            <Textarea
              key={field}
              label={column.name}
              value={value}
              onChange={(e) => updateDraftField(field, e.target.value)}
              autosize
              minRows={3}
              maxRows={5}
              readOnly={column.readonly}
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
            value={draftRecord.fields[field] as number}
            onChange={(value) => updateDraftField(field, value.toString())}
            readOnly={column.readonly}
          />
        );
      }
      if (column.pgType === PostgresColumnType.BOOLEAN) {
        return (
          <Checkbox
            key={field}
            label={column.name}
            checked={value === 'true'}
            onChange={(e) => updateDraftField(field, e.target.checked.toString())}
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
            value={value}
            autosize
            minRows={3}
            maxRows={5}
            readOnly={column.readonly}
          />
        );
      }

      return (
        <TextInput
          key={field}
          label={column.name}
          value={value}
          onChange={(e) => updateDraftField(field, e.target.value)}
          readOnly={column.readonly}
        />
      );
    },
    [draftRecord, updateDraftField],
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

  if (draftRecord && currentColumn) {
    recordContent = fieldToInput(currentColumn.id.wsId, table, true);
  } else if (draftRecord) {
    recordContent = (
      <>
        <Text>Record Details</Text>
        {draftRecord.fields &&
          Object.keys(draftRecord.fields).map((fieldName) => fieldToInput(fieldName, table, false))}
      </>
    );
  }

  return (
    <Stack h="100%" w="100%" gap={0} p={0}>
      <Modal opened={unsavedChangesModalOpened} onClose={closeUnsavedChangesModal} title="Record has unsaved changes">
        <Stack>
          <Text>You have unsaved changes to this record. Do you want to discard them?</Text>
          <Group>
            <Button variant="outline" onClick={closeUnsavedChangesModal}>
              Cancel
            </Button>
            <Button
              variant="filled"
              onClick={() => {
                if (afterModalAction.action === 'switchToRecord' && afterModalAction.switchToRecord) {
                  setCurrentRecordId(afterModalAction.switchToRecord.id.wsId);
                  setDraftRecord(_.cloneDeep(afterModalAction.switchToRecord));
                  setRecordDirty(false);
                } else {
                  setDraftRecord(undefined);
                }
                closeUnsavedChangesModal();
              }}
            >
              Discard
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Group p="xs">
        <ActionIcon variant="subtle" onClick={onSwitchToSpreadsheetView} c="black">
          <ArrowLeftIcon />
        </ActionIcon>
        <Text>Record View</Text>
        <Group ml="auto">
          {draftRecord && recordDirty && (
            <Button variant="filled" size="xs" onClick={saveDraftRecord}>
              Save
            </Button>
          )}
        </Group>
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
                          setCurrentColumnId(undefined);
                        } else {
                          setCurrentColumnId(c.id.wsId);
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
