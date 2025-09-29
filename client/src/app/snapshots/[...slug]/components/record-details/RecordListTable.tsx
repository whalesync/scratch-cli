import { TextRegularXs } from '@/app/components/base/text';
import { SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { Box, Stack, StyleProp, Table, Tooltip } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import _ from 'lodash';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { identifyRecordTitleColumn } from '../snapshot-grid/header-column-utils';

interface RecordListTableProps {
  records: SnapshotRecord[] | undefined;
  table: TableSpec;
  selectedRecordId: string | undefined;
  selectedFieldId: string | undefined;
  onSelect: (record: SnapshotRecord, columnId?: string) => void;
  w?: StyleProp<React.CSSProperties['width']>;
  mih: StyleProp<React.CSSProperties['minHeight']>;
}

export interface RecordListTableRef {
  scrollToRecord: (recordId: string, behavior?: 'smooth' | 'instant') => void;
}

const ID_COLUMN_WIDTH = '80px'; // 30%
const TITLE_COLUMN_WIDTH = `220px`; // 70%

export const RecordListTable = forwardRef<RecordListTableRef, RecordListTableProps>(function RecordListTable(
  { records, table, selectedRecordId, onSelect, w, mih },
  ref,
) {
  const [initalScrollComplete, setInitalScrollComplete] = useState(false);
  const titleColumnId = identifyRecordTitleColumn(table);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const goToNextRecord = useCallback(() => {
    if (!records) return;
    const currentIndex = records?.findIndex((record) => record.id.wsId === selectedRecordId);
    if (currentIndex !== undefined && currentIndex < records.length - 1) {
      onSelect(records[currentIndex + 1]);
    }
  }, [records, selectedRecordId, onSelect]);

  const goToPreviousRecord = useCallback(() => {
    if (!records) return;
    const currentIndex = records?.findIndex((record) => record.id.wsId === selectedRecordId);
    if (currentIndex !== undefined && currentIndex > 0) {
      onSelect(records[currentIndex - 1]);
    }
  }, [records, selectedRecordId, onSelect]);

  const scrollToRecord = useCallback((recordId: string, behavior: 'smooth' | 'instant' = 'smooth') => {
    if (!scrollContainerRef.current) return;

    const recordElement = scrollContainerRef.current.querySelector(`[data-record-id="${recordId}"]`);
    if (recordElement) {
      recordElement.scrollIntoView({
        behavior,
        block: 'center',
      });
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      scrollToRecord,
    }),
    [scrollToRecord],
  );

  useHotkeys(
    [
      ['arrowup', () => goToPreviousRecord()],
      ['arrowdown', () => goToNextRecord()],
    ],
    ['INPUT', 'TEXTAREA'],
  );

  useEffect(() => {
    if (records && records.length > 0 && !initalScrollComplete && selectedRecordId) {
      scrollToRecord(selectedRecordId, 'instant');
      setInitalScrollComplete(true);
    }
  }, [records, scrollToRecord, initalScrollComplete, setInitalScrollComplete, selectedRecordId]);

  const rows = records?.map((record) => {
    const isSelected = selectedRecordId === record.id.wsId;

    const title = record.fields[titleColumnId] as string;
    const truncatedTitle = _.truncate(title, { length: 30, omission: '...' });
    return (
      <Table.Tr
        key={record.id.wsId}
        onClick={() => onSelect(record)}
        style={{ cursor: 'pointer' }}
        data-record-id={record.id.wsId}
      >
        <Table.Td miw={ID_COLUMN_WIDTH} style={{ textTransform: 'uppercase' }}>
          <TextRegularXs fw={isSelected ? 'bold' : 'normal'}>
            {_.truncate(record.id.wsId, { length: 8, omission: '...' })}
          </TextRegularXs>
        </Table.Td>
        <Table.Td miw={TITLE_COLUMN_WIDTH} style={{ textWrap: 'nowrap' }}>
          <Tooltip label={title} disabled={title === truncatedTitle} position="right" withArrow>
            <TextRegularXs fw={isSelected ? 'bold' : 'normal'}>{truncatedTitle}</TextRegularXs>
          </Tooltip>
        </Table.Td>
      </Table.Tr>
    );
  });
  return (
    <>
      <RecordListTableHeader table={table} h="36px" />
      <Stack
        ref={scrollContainerRef}
        mih={mih}
        gap="0"
        p="0"
        style={{ overflowY: 'scroll', overflowX: 'hidden', scrollBehavior: 'smooth' }}
      >
        <Table w={w} highlightOnHover withColumnBorders withRowBorders withTableBorder>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      </Stack>
    </>
  );
});

export const RecordListTableHeader = ({
  table,
  w,
  h,
}: {
  table: TableSpec;
  w?: StyleProp<React.CSSProperties['width']>;
  h?: StyleProp<React.CSSProperties['height']>;
}) => {
  const titleColumnId = identifyRecordTitleColumn(table);
  const titleColumnName = table.columns.find((column) => column.id.wsId === titleColumnId)?.name ?? 'Title';

  return (
    <Box w={w} h={h} p="0" m="0" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
      <Table withColumnBorders withRowBorders={false} withTableBorder={false}>
        <Table.Tbody>
          <Table.Tr>
            <Table.Td miw={ID_COLUMN_WIDTH}>
              <TextRegularXs>ID</TextRegularXs>
            </Table.Td>
            <Table.Td miw={TITLE_COLUMN_WIDTH}>
              <TextRegularXs style={{ textTransform: 'uppercase' }}>{titleColumnName}</TextRegularXs>
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Box>
  );
};
