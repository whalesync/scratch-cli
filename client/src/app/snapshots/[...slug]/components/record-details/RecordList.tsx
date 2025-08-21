import { StyledIcon } from '@/app/components/Icons/StyledIcon';
import { buildRecordTitle, PostgresColumnType, SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { isColumnHidden, isColumnProtected } from '@/types/server-entities/view';
import { Center, Group, Stack, Text, Tooltip, useMantineTheme } from '@mantine/core';
import {
  EyeSlashIcon,
  FlagIcon,
  FolderIcon,
  FolderOpenIcon,
  HashIcon,
  IconProps,
  LockIcon,
  TextAaIcon,
} from '@phosphor-icons/react';
import { useMemo } from 'react';
import { useSnapshotContext } from '../../SnapshotContext';

interface RecordListProps {
  records: SnapshotRecord[] | undefined;
  table: TableSpec;
  selectedRecordId: string | undefined;
  selectedFieldId: string | undefined;
  onSelect: (record: SnapshotRecord, columnId?: string) => void;
}

interface ColumnMetaData {
  id: string;
  name: string;
  dataType: string;
  isProtected: boolean;
  isHidden: boolean;
  isActive: boolean;
}

export const RecordList = ({ records, table, selectedRecordId, selectedFieldId, onSelect }: RecordListProps) => {
  const { currentView } = useSnapshotContext();

  const columnMetaData: ColumnMetaData[] = useMemo(() => {
    return table.columns.map((column) => ({
      id: column.id.wsId,
      name: column.name,
      dataType: column.pgType,
      isProtected: !!(currentView && isColumnProtected(table.id.wsId, column.id.wsId, currentView)),
      isHidden: !!(currentView && isColumnHidden(table.id.wsId, column.id.wsId, currentView)),
      isActive: selectedFieldId === column.id.wsId,
    }));
  }, [table, currentView, selectedFieldId]);

  return (
    <Stack gap="4px">
      {records?.map((record) => (
        <RecordNode
          key={record.id.wsId}
          record={record}
          columnMetaData={columnMetaData}
          isActive={selectedRecordId === record.id.wsId}
          activeColumnId={selectedFieldId}
          onClick={(columnId) => onSelect(record, columnId)}
        />
      ))}
    </Stack>
  );
};

const RecordNode = ({
  record,
  columnMetaData,
  isActive,
  activeColumnId,
  onClick,
}: {
  record: SnapshotRecord;
  columnMetaData: ColumnMetaData[];
  isActive: boolean;
  activeColumnId: string | undefined;
  onClick: (columnId?: string) => void;
}) => {
  const theme = useMantineTheme();
  const color = isActive ? theme.colors.gray[7] : theme.colors.gray[6];
  const icon = <StyledIcon Icon={isActive ? FolderOpenIcon : FolderIcon} size={22} c={color} />;

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
          {columnMetaData.map((column) => {
            return <ColumnNode key={column.id} column={column} onClick={(id) => onClick(id)} />;
          })}
        </Stack>
      )}
    </Stack>
  );
};

const ColumnNode = ({ column, onClick }: { column: ColumnMetaData; onClick: (columnId?: string) => void }) => {
  const theme = useMantineTheme();
  const color = column.isActive ? theme.colors.gray[7] : theme.colors.gray[6];
  const iconSize = 14;
  const iconContainerSize = 14; // Tooltips don't work with just an icon component, it needs a container

  return (
    <Group
      gap={5}
      onClick={() => {
        if (column.isActive) {
          onClick(undefined);
        } else {
          onClick(column.id);
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      <DataTypeIcon dataType={column.dataType} color={color} size={14} strokeWidth={column.isActive ? 2.5 : 1.5} />
      <Text fz="sm" fw={column.isActive ? 'bold' : 'normal'} c={color}>
        {column.name}
      </Text>
      {column.isProtected ? (
        <Tooltip label="This field is protected from AI suggestions" position="right">
          <Center w={iconContainerSize} h={iconContainerSize}>
            <StyledIcon Icon={LockIcon} size={iconSize} c={color} weight={column.isActive ? 'bold' : undefined} />
          </Center>
        </Tooltip>
      ) : null}
      {column.isHidden ? (
        <Tooltip label="This field is hidden from the AI in the current view" position="right">
          <Center w={iconContainerSize} h={iconContainerSize}>
            <StyledIcon Icon={EyeSlashIcon} size={iconSize} c={color} weight={column.isActive ? 'bold' : undefined} />
          </Center>
        </Tooltip>
      ) : null}
    </Group>
  );
};

const DataTypeIcon = (props: IconProps & { dataType: string }) => {
  const { dataType, ...iconProps } = props;

  if (dataType === PostgresColumnType.NUMERIC || dataType === PostgresColumnType.NUMERIC_ARRAY) {
    return <HashIcon {...iconProps} />;
  } else if (dataType === PostgresColumnType.BOOLEAN) {
    return <FlagIcon {...iconProps} />;
  } else {
    return <TextAaIcon {...iconProps} />;
  }
};
