import { TextRegularXs } from '@/app/components/base/text';
import { identifyRecordTitleColumn, SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { StyleProp, Table } from '@mantine/core';
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
    return (
      <Table.Tr key={record.id.wsId} onClick={() => onSelect(record)} style={{ cursor: 'pointer' }}>
        <Table.Td miw={ID_COLUMN_WIDTH} style={{ textTransform: 'uppercase' }}>
          <TextRegularXs fw={isSelected ? 'bold' : 'normal'}>
            {_.truncate(record.id.wsId, { length: 8, omission: '...' })}
          </TextRegularXs>
        </Table.Td>
        <Table.Td miw={TITLE_COLUMN_WIDTH}>
          <TextRegularXs fw={isSelected ? 'bold' : 'normal'}>
            {_.truncate(record.fields[titleColumnId] as string, { length: 100, omission: '...' })}
          </TextRegularXs>
        </Table.Td>
      </Table.Tr>
    );
  });
  return (
    <Table w={w} highlightOnHover withColumnBorders>
      <Table.Tbody>{rows}</Table.Tbody>
    </Table>
  );
};

export const RecordListTableHeader = ({
  table,
  w,
}: {
  table: TableSpec;
  w?: StyleProp<React.CSSProperties['width']>;
}) => {
  const titleColumnId = identifyRecordTitleColumn(table);
  const titleColumnName = table.columns.find((column) => column.id.wsId === titleColumnId)?.name ?? 'Title';

  return (
    <Table withColumnBorders w={w}>
      <Table.Tr>
        <Table.Tr>
          <Table.Td miw={ID_COLUMN_WIDTH}>
            <TextRegularXs>ID</TextRegularXs>
          </Table.Td>
          <Table.Td miw={TITLE_COLUMN_WIDTH}>
            <TextRegularXs style={{ textTransform: 'uppercase' }}>{titleColumnName}</TextRegularXs>
          </Table.Td>
        </Table.Tr>
      </Table.Tr>
    </Table>
  );
};
