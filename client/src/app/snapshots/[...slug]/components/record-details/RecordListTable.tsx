import { TextRegularXs } from '@/app/components/base/text';
import { identifyRecordTitleColumn, SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { Box, StyleProp, Table, Tooltip } from '@mantine/core';
import _ from 'lodash';

interface RecordListTableProps {
  records: SnapshotRecord[] | undefined;
  table: TableSpec;
  selectedRecordId: string | undefined;
  selectedFieldId: string | undefined;
  onSelect: (record: SnapshotRecord, columnId?: string) => void;
  w?: StyleProp<React.CSSProperties['width']>;
}

const ID_COLUMN_WIDTH = '80px'; // 30%
const TITLE_COLUMN_WIDTH = `220px`; // 70%

export const RecordListTable = ({ records, table, selectedRecordId, onSelect, w }: RecordListTableProps) => {
  const titleColumnId = identifyRecordTitleColumn(table);

  const rows = records?.map((record) => {
    const isSelected = selectedRecordId === record.id.wsId;

    const title = record.fields[titleColumnId] as string;
    const truncatedTitle = _.truncate(title, { length: 30, omission: '...' });
    return (
      <Table.Tr key={record.id.wsId} onClick={() => onSelect(record)} style={{ cursor: 'pointer' }}>
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
    <Table w={w} highlightOnHover withColumnBorders withRowBorders withTableBorder>
      <Table.Tbody>{rows}</Table.Tbody>
    </Table>
  );
};

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
        <Table.Tr>
          <Table.Td miw={ID_COLUMN_WIDTH}>
            <TextRegularXs>ID</TextRegularXs>
          </Table.Td>
          <Table.Td miw={TITLE_COLUMN_WIDTH}>
            <TextRegularXs style={{ textTransform: 'uppercase' }}>{titleColumnName}</TextRegularXs>
          </Table.Td>
        </Table.Tr>
      </Table>
    </Box>
  );
};
