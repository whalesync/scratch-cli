import { useFocusedCellsContext } from '@/app/snapshots/[id]/FocusedCellsContext';
import { useSnapshotContext } from '@/app/snapshots/[id]/SnapshotContext';
import { useSnapshotRecords } from '@/hooks/use-snapshot';
import { SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { ActionIcon, Anchor, Center, Divider, Group, Loader, ScrollArea, Stack, Tabs, Text } from '@mantine/core';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { RecordDetails } from './RecordDetails';

interface RecordViewProps {
  table: TableSpec;
  initialRecordId?: string;
  initialColumnId?: string;
  onSwitchToSpreadsheetView: () => void;
  filterToView?: boolean;
}

export const RecordView = ({
  table,
  initialRecordId,
  initialColumnId,
  onSwitchToSpreadsheetView,
  filterToView,
}: RecordViewProps) => {
  const { snapshot, currentView } = useSnapshotContext();
  const { setWriteFocus } = useFocusedCellsContext();
  const [currentRecordId, setCurrentRecordId] = useState<string | undefined>(initialRecordId);
  const [currentColumnId, setCurrentColumnId] = useState<string | undefined>(initialColumnId);

  const activeView = currentView;

  const { records, isLoading, error, bulkUpdateRecords, acceptCellValues, rejectCellValues } = useSnapshotRecords({
    snapshotId: snapshot?.id ?? '',
    tableId: table.id.wsId,
    viewId: filterToView && activeView ? activeView.id : undefined,
  });

  const focusRecord = useCallback(
    (record: SnapshotRecord, columnId?: string) => {
      const cells = columnId
        ? [{ recordWsId: record.id.wsId, columnWsId: columnId }]
        : Object.keys(record.fields).map((field) => ({ recordWsId: record.id.wsId, columnWsId: field }));

      setWriteFocus(cells);
    },
    [setWriteFocus],
  );

  useEffect(() => {
    if (!currentRecordId && records && records?.length > 0) {
      const record = records[0];
      setCurrentRecordId(record.id.wsId);
      focusRecord(record);
    }
  }, [records, currentRecordId, focusRecord]);

  const handleSelectRecord = useCallback(
    (record: SnapshotRecord) => {
      setCurrentRecordId(record.id.wsId);
      focusRecord(record, currentColumnId);
    },
    [focusRecord, currentColumnId, setCurrentRecordId],
  );

  const handleSelectColumn = useCallback(
    (record: SnapshotRecord, columnId?: string) => {
      setCurrentColumnId(columnId);
      focusRecord(record, columnId);
    },
    [focusRecord, setCurrentColumnId],
  );

  const handleExistRecordView = useCallback(() => {
    setWriteFocus([]);
    onSwitchToSpreadsheetView();
  }, [onSwitchToSpreadsheetView]);

  if (error) {
    return (
      <Center h="100%">
        <Text c="red">Error loading records: {error.message}</Text>
      </Center>
    );
  }

  if (isLoading && !records) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack h="100%" w="100%" gap={0} p={0}>
      <Group p="xs">
        <ActionIcon variant="subtle" onClick={handleExistRecordView} c="black">
          <ArrowLeftIcon />
        </ActionIcon>
        <Text>Record View</Text>
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
          <Tabs value={currentRecordId} flex={1}>
            {records?.map((record) => (
              <Tabs.Panel key={record.id.wsId} value={record.id.wsId} h="100%">
                <ScrollArea h="calc(100vh - 250px)" type="hover">
                  <RecordDetails
                    snapshotId={snapshot?.id ?? ''}
                    currentRecord={record}
                    table={table}
                    currentColumnId={currentColumnId}
                    acceptCellValues={acceptCellValues}
                    rejectCellValues={rejectCellValues}
                    bulkUpdateRecord={bulkUpdateRecords}
                  />
                </ScrollArea>
              </Tabs.Panel>
            ))}
          </Tabs>
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
