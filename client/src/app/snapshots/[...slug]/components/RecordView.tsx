import { useAgentChatContext } from '@/app/snapshots/[...slug]/components/contexts/agent-chat-context';
import { useSnapshotContext } from '@/app/snapshots/[...slug]/components/contexts/SnapshotContext';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { identifyRecordTitleColumn, TableSpec } from '@/types/server-entities/snapshot';
import { Center, Group, Loader, ScrollArea, Stack, Tabs, Text } from '@mantine/core';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useSnapshotParams } from '../hooks/use-snapshot-params';
import { useTableContext } from './contexts/table-context';
import { RecordDetails } from './record-details/RecordDetails';
import { RecordDetailsHeader } from './record-details/RecordDetailsHeader';
import { RecordListTable, RecordListTableRef } from './record-details/RecordListTable';
import { RecordSuggestionToolbar } from './RecordSuggestionToolbar';

interface RecordViewProps {
  table: TableSpec;
}

const SUGGESTION_TOOLBAR_HEIGHT = 40;

const getRecordViewHeight = (hasSuggestions: boolean) => {
  return `calc(100vh - 150px ${hasSuggestions ? `-${SUGGESTION_TOOLBAR_HEIGHT}px` : ''})`;
};

export const RecordView: FC<RecordViewProps> = (props) => {
  const { table } = props;

  const { activeRecord } = useTableContext();
  const recordListTableRef = useRef<RecordListTableRef>(null);

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
    (recordId: string, columnId?: string) => {
      const record = records?.find((r) => r.id.wsId === recordId);
      if (!record) return;

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
    [setWriteFocus, setColumnScope, updateSnapshotPath, snapshot?.id, table.id.wsId, setRecordScope, records],
  );

  useEffect(() => {
    if (!currentRecordId && records && records?.length > 0) {
      const record = records[0];
      setCurrentRecordId(record.id.wsId);

      const titleColumnId = identifyRecordTitleColumn(table);
      setCurrentColumnId(titleColumnId);
      focusRecord(record.id.wsId, titleColumnId);
      // Scroll to the first record
      recordListTableRef.current?.scrollToRecord(record.id.wsId);
    }
  }, [records, currentRecordId, focusRecord, table]);

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

  const handleSwitchColumn = useCallback(
    (recordId: string, columnId: string | undefined) => {
      console.log('handleSwitchColumn', recordId, columnId);
      if (columnId !== currentColumnId) {
        setCurrentColumnId(columnId);
        focusRecord(recordId, columnId);
      }
    },
    [focusRecord, setCurrentColumnId, currentColumnId],
  );

  const handleSwitchRecord = useCallback(
    (recordId: string, columnId?: string) => {
      console.log('handleSwitchRecord', recordId, columnId);
      if (recordId !== currentRecordId) {
        setCurrentRecordId(recordId);
        focusRecord(recordId, currentColumnId);
        // Scroll to the selected record
        recordListTableRef.current?.scrollToRecord(recordId);
      }

      if (columnId !== currentColumnId) {
        setCurrentColumnId(columnId);
        focusRecord(recordId, columnId);
      }
    },
    [focusRecord, setCurrentRecordId, setCurrentColumnId, currentColumnId, currentRecordId],
  );

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

  // Determine if there are suggestions and if we need to adjust the layout to make room for the suggestion toolbar
  const currentRecord = records?.find((r) => r.id.wsId === currentRecordId);
  const columnsWithSuggestions = Object.keys(currentRecord?.__suggested_values || {});
  const hasSuggestions =
    columnsWithSuggestions.length > 0 && (!currentColumnId || columnsWithSuggestions.includes(currentColumnId));
  return (
    <Stack h="100%" w="100%" gap={0} p={0} style={{ position: 'relative' }}>
      <Group
        gap={0}
        p={0}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: hasSuggestions ? `${SUGGESTION_TOOLBAR_HEIGHT}px` : '0',
        }}
      >
        <Stack h="100%" w="300px" gap="0" style={{ borderRight: '1px solid #e0e0e0' }}>
          <RecordListTable
            ref={recordListTableRef}
            mih={getRecordViewHeight(hasSuggestions)}
            records={records}
            table={table}
            selectedRecordId={currentRecordId}
            selectedFieldId={currentColumnId}
            onSelect={(record) => {
              handleSwitchRecord(record.id.wsId, currentColumnId);
            }}
          />
        </Stack>
        <Stack h="100%" gap="xs" flex={1}>
          {currentRecordId && (
            <RecordDetailsHeader
              h="36px"
              table={table}
              columnId={currentColumnId}
              onSwitchColumn={(columnId) => {
                handleSwitchColumn(currentRecordId, columnId);
              }}
            />
          )}
          <Tabs value={currentRecordId} flex={1} bg={'transparent'} keepMounted={false}>
            {records?.map((record) => (
              <Tabs.Panel key={record.id.wsId} value={record.id.wsId} h="100%" p="3rem">
                <ScrollArea h="calc(100vh - 240px)" type="hover" scrollbars="y">
                  <RecordDetails
                    snapshotId={snapshot?.id ?? ''}
                    currentRecord={record}
                    table={table}
                    currentColumnId={currentColumnId}
                    acceptCellValues={acceptCellValues}
                    rejectCellValues={rejectCellValues}
                    onFocusOnField={(columnId) => {
                      handleSwitchColumn(record.id.wsId, columnId);
                    }}
                  />
                </ScrollArea>
              </Tabs.Panel>
            ))}
          </Tabs>
        </Stack>
      </Group>
      {currentRecord && hasSuggestions && (
        <RecordSuggestionToolbar
          record={currentRecord}
          table={table}
          columnId={currentColumnId}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
        />
      )}
    </Stack>
  );
};
