import { useAgentChatContext } from '@/app/snapshots/[...slug]/components/contexts/agent-chat-context';
import { useSnapshotContext } from '@/app/snapshots/[...slug]/components/contexts/SnapshotContext';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { Center, Group, Loader, ScrollArea, Stack, Tabs, Text } from '@mantine/core';
import { FC, useCallback, useEffect, useState } from 'react';
import { useSnapshotParams } from '../hooks/use-snapshot-params';
import { useTableContext } from './contexts/table-context';
import { RecordDetails } from './record-details/RecordDetails';
import { RecordList } from './record-details/RecordList';

interface RecordViewProps {
  table: TableSpec;
}

export const RecordView: FC<RecordViewProps> = (props) => {
  const { table } = props;

  const { activeRecord } = useTableContext();

  const { snapshot, currentViewId, viewDataAsAgent } = useSnapshotContext();
  const { updateSnapshotPath } = useSnapshotParams();
  const { setWriteFocus, setRecordScope, setColumnScope, dataScope } = useAgentChatContext();
  const [currentRecordId, setCurrentRecordId] = useState<string | undefined>(activeRecord?.recordId);
  const [currentColumnId, setCurrentColumnId] = useState<string | undefined>(activeRecord?.columnId);

  const { records, isLoading, error, acceptCellValues, rejectCellValues } = useSnapshotTableRecords({
    snapshotId: snapshot?.id ?? '',
    tableId: table.id.wsId,
    viewId: viewDataAsAgent && currentViewId ? currentViewId : undefined,
  });

  const focusRecord = useCallback(
    (record: SnapshotRecord, columnId?: string) => {
      const cells = columnId
        ? [{ recordWsId: record.id.wsId, columnWsId: columnId }]
        : Object.keys(record.fields).map((field) => ({ recordWsId: record.id.wsId, columnWsId: field }));

      setWriteFocus(cells);
      if (columnId) {
        setColumnScope(record.id.wsId, columnId);
        updateSnapshotPath(snapshot?.id ?? '', table.id.wsId, record.id.wsId, columnId);
      } else {
        setRecordScope(record.id.wsId);
        updateSnapshotPath(snapshot?.id ?? '', table.id.wsId, record.id.wsId);
      }
    },
    [setWriteFocus, setColumnScope, updateSnapshotPath, snapshot?.id, table.id.wsId, setRecordScope],
  );

  useEffect(() => {
    if (!currentRecordId && records && records?.length > 0) {
      const record = records[0];
      setCurrentRecordId(record.id.wsId);
      focusRecord(record);
    }
  }, [records, currentRecordId, focusRecord]);

  useEffect(() => {
    if (dataScope === 'table') {
      // Need to set the scope when direct linking to record view
      const record = records?.find((r) => r.id.wsId === currentRecordId);
      if (record && currentColumnId && currentRecordId) {
        setColumnScope(record.id.wsId, currentColumnId);
      } else if (record && currentRecordId) {
        setRecordScope(record.id.wsId);
      }
    }
  }, [dataScope, currentColumnId, currentRecordId, records, setColumnScope, setRecordScope]);

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
  /**
   * Layout is a bit wonky here due to the tabs and many divs.
   * Need 50px for the tabs at the top
   * Need 50px for the Views toolbar at the bottom (in a higher div)
   * everything between needs to fill in
   * Requires setting fixed height on the parent div and the hieght of scroll area with
   * the record details
   */

  return (
    <Stack h="calc(100vh - 100px)" w="100%" gap={0} p={0}>
      <Group gap={0} p={0} h="100%">
        <Stack h="100%" w="20%" style={{ borderRight: '1px solid #e0e0e0' }}>
          <ScrollArea h="100%" type="hover" scrollbars="y">
            <Stack mih="calc(100vh - 105px)" gap="sm" p="xs" mr="xs" style={{ overflow: 'hidden' }}>
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
              <Tabs.Panel key={record.id.wsId} value={record.id.wsId} h="100%" p="3rem" bg="white">
                <ScrollArea h="calc(100vh - 200px)" type="hover" scrollbars="y">
                  <RecordDetails
                    snapshotId={snapshot?.id ?? ''}
                    currentRecord={record}
                    table={table}
                    currentColumnId={currentColumnId}
                    acceptCellValues={acceptCellValues}
                    rejectCellValues={rejectCellValues}
                    onFocusOnField={(columnId) => {
                      if (columnId !== currentColumnId) {
                        setCurrentColumnId(columnId);
                        focusRecord(record, columnId);
                      }
                    }}
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
