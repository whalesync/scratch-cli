import {
  buildRecordTitle,
  ColumnSpec,
  PostgresColumnType,
  SnapshotRecord,
  TableSpec,
} from '@/types/server-entities/snapshot';
import { ColumnView, isColumnHidden, isColumnProtected } from '@/types/server-entities/view';
import { Group, Stack, Text, useMantineTheme } from '@mantine/core';
import { FlagIcon, FolderIcon, FolderOpenIcon, HashIcon, IconProps, TextAaIcon } from '@phosphor-icons/react';
import { useSnapshotContext } from '../SnapshotContext';
import { ICONS } from '../icons';

interface RecordListProps {
  records: SnapshotRecord[] | undefined;
  table: TableSpec;
  selectedRecordId: string | undefined;
  selectedFieldId: string | undefined;
  onSelect: (record: SnapshotRecord, columnId?: string) => void;
}

export const RecordList = ({ records, table, selectedRecordId, selectedFieldId, onSelect }: RecordListProps) => {
  const { currentView } = useSnapshotContext();

  return (
    <Stack gap="4px">
      {records?.map((record) => (
        <RecordNode
          key={record.id.wsId}
          record={record}
          table={table}
          isActive={selectedRecordId === record.id.wsId}
          activeColumnId={selectedFieldId}
          currentView={currentView}
          onClick={(columnId) => onSelect(record, columnId)}
        />
      ))}
    </Stack>
  );
};

const RecordNode = ({
  record,
  table,
  isActive,
  activeColumnId,
  currentView,
  onClick,
}: {
  table: TableSpec;
  record: SnapshotRecord;
  isActive: boolean;
  activeColumnId: string | undefined;
  currentView: ColumnView | undefined;
  onClick: (columnId?: string) => void;
}) => {
  const theme = useMantineTheme();
  const color = isActive ? theme.colors.gray[7] : theme.colors.gray[6];
  const icon = isActive ? (
    <FolderOpenIcon color={color} size={20} strokeWidth={2.5} />
  ) : (
    <FolderIcon color={color} size={20} strokeWidth={1.5} />
  );

  const recordTitle = buildRecordTitle(record);

  return (
    <Stack p={0} gap="2px">
      <Group
        gap={5}
        align="flex-start"
        onClick={() => onClick(activeColumnId)}
        style={{ cursor: 'pointer' }}
        wrap="nowrap"
      >
        {icon}
        <Text fw={isActive ? 'bold' : 'normal'} c={color}>
          {recordTitle}
        </Text>
      </Group>
      {isActive && (
        <Stack ml="19px" gap="2px">
          {table.columns.map((column) => {
            const isProjected = currentView && isColumnProtected(table.id.wsId, column.id.wsId, currentView);
            const isHidden = currentView && isColumnHidden(table.id.wsId, column.id.wsId, currentView);

            return isHidden ? null : (
              <ColumnNode
                key={column.id.wsId}
                column={column}
                isActive={activeColumnId === column.id.wsId}
                isProtected={!!isProjected}
                isHidden={!!isHidden}
                onClick={(id) => onClick(id)}
              />
            );
          })}
        </Stack>
      )}
    </Stack>
  );
};

const ColumnNode = ({
  column,
  isActive,
  isProtected,
  onClick,
}: {
  column: ColumnSpec;
  isActive: boolean;
  isProtected: boolean;
  isHidden: boolean;
  onClick: (columnId?: string) => void;
}) => {
  const theme = useMantineTheme();
  const color = isActive ? theme.colors.gray[7] : theme.colors.gray[6];

  return (
    <Group
      gap={5}
      onClick={() => {
        if (isActive) {
          onClick(undefined);
        } else {
          onClick(column.id.wsId);
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      <DataTypeIcon column={column} color={color} size={14} strokeWidth={isActive ? 2.5 : 1.5} />
      <Text fz="sm" fw={isActive ? 'bold' : 'normal'} c={color}>
        {column.name} {isProtected ? ICONS.protected : null}
      </Text>
    </Group>
  );
};

const DataTypeIcon = (props: IconProps & { column: ColumnSpec }) => {
  if (props.column.pgType === PostgresColumnType.NUMERIC || props.column.pgType === PostgresColumnType.NUMERIC_ARRAY) {
    return <HashIcon {...props} />;
  } else if (props.column.pgType === PostgresColumnType.BOOLEAN) {
    return <FlagIcon {...props} />;
  } else {
    return <TextAaIcon {...props} />;
  }
};
