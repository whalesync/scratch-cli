import { TextRegularSm } from '@/app/components/base/text';
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

export const RecordListTable = ({ records, table, selectedRecordId, onSelect, w }: RecordListTableProps) => {
  const titleColumnId = identifyRecordTitleColumn(table);

  const rows = records?.map((record) => {
    const isSelected = selectedRecordId === record.id.wsId;
    return (
      <Table.Tr
        key={record.id.wsId}
        onClick={() => onSelect(record)}
        style={{ cursor: 'pointer' }}
        bg={isSelected ? 'gray.0' : 'transparent'}
      >
        <Table.Td w="40%" style={{ textTransform: 'uppercase' }}>
          {_.truncate(record.id.wsId, { length: 12, omission: '...' })}
        </Table.Td>
        <Table.Td w="60%">
          {_.truncate(record.fields[titleColumnId] as string, { length: 100, omission: '...' })}
        </Table.Td>
      </Table.Tr>
    );
  });
  return (
    <Table w={w} highlightOnHover withColumnBorders stickyHeader highlightOnHoverColor="gray.5">
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
      <Table.Thead>
        <Table.Tr>
          <Table.Td w="40%">
            <TextRegularSm>ID</TextRegularSm>
          </Table.Td>
          <Table.Td w="60%">
            <TextRegularSm style={{ textTransform: 'uppercase' }}>{titleColumnName}</TextRegularSm>
          </Table.Td>
        </Table.Tr>
      </Table.Thead>
    </Table>
  );
};
