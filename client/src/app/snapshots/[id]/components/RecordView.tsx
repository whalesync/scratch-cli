import { useFocusedCellsContext } from '@/app/snapshots/[id]/FocusedCellsContext';
import { useSnapshotContext } from '@/app/snapshots/[id]/SnapshotContext';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot';
import { SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { Center, Group, Loader, ScrollArea, Stack, Tabs, Text } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { RecordDetails } from './RecordDetails';
import { RecordList } from './RecordList';

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
  const { setWriteFocus, setRecordScope, setColumnScope, setTableScope } = useFocusedCellsContext();
  const [currentRecordId, setCurrentRecordId] = useState<string | undefined>(initialRecordId);
  const [currentColumnId, setCurrentColumnId] = useState<string | undefined>(initialColumnId);

  const { records, isLoading, error, bulkUpdateRecords, acceptCellValues, rejectCellValues } = useSnapshotTableRecords({
    snapshotId: snapshot?.id ?? '',
    tableId: table.id.wsId,
    viewId: filterToView && currentView ? currentView.id : undefined,
  });

  const focusRecord = useCallback(
    (record: SnapshotRecord, columnId?: string) => {
      const cells = columnId
        ? [{ recordWsId: record.id.wsId, columnWsId: columnId }]
        : Object.keys(record.fields).map((field) => ({ recordWsId: record.id.wsId, columnWsId: field }));

      setWriteFocus(cells);
      if (columnId) {
        setColumnScope(record.id.wsId, columnId);
      } else {
        setRecordScope(record.id.wsId);
      }
    },
    [setWriteFocus, setColumnScope, setRecordScope],
  );

  useEffect(() => {
    if (!currentRecordId && records && records?.length > 0) {
      const record = records[0];
      setCurrentRecordId(record.id.wsId);
      focusRecord(record);
    }
  }, [records, currentRecordId, focusRecord]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleExitRecordView = useCallback(() => {
    setWriteFocus([]);
    setTableScope();
    onSwitchToSpreadsheetView();
  }, [onSwitchToSpreadsheetView, setTableScope, setWriteFocus]);

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
      <Group gap={0} p={0} h="100%">
        <Stack h="100%" w="20%" style={{ borderRight: '1px solid #e0e0e0' }}>
          <ScrollArea h="100%" type="hover" scrollbars="y">
            <Stack h="calc(100vh - 105px)" gap="sm" p="xs">
              <RecordList
                records={records}
                table={table}
                selectedRecordId={currentRecordId}
                selectedFieldId={currentColumnId}
                onSelect={(record, columnId) => {
                  if (record.id.wsId !== currentRecordId) {
                    setCurrentRecordId(record.id.wsId);
                    focusRecord(record, currentColumnId);
                  }

                  if (columnId !== currentColumnId) {
                    setCurrentColumnId(columnId);
                    focusRecord(record, columnId);
                  }
                }}
              />
            </Stack>
          </ScrollArea>
        </Stack>
        <Stack h="100%" gap="xs" flex={1}>
          <Tabs value={currentRecordId} flex={1} bg={'transparent'} keepMounted={false}>
            {records?.map((record) => (
              <Tabs.Panel key={record.id.wsId} value={record.id.wsId} h="100%" p="xs" bg="white">
                <ScrollArea h="calc(100vh - 105px)" type="hover" scrollbars="y">
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
