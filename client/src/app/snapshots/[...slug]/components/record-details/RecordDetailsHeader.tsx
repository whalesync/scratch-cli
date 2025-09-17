import { TextRegularXs } from '@/app/components/base/text';
import { TableSpec } from '@/types/server-entities/snapshot';
import { ActionIcon, Group, StyleProp } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useCallback } from 'react';

interface RecordDetailsHeaderProps {
  table: TableSpec;
  w?: StyleProp<React.CSSProperties['width']>;
  h?: StyleProp<React.CSSProperties['height']>;
  columnId: string;
  onSwitchColumn: (columnId: string) => void;
}

export const RecordDetailsHeader = ({ table, w, h, columnId, onSwitchColumn }: RecordDetailsHeaderProps) => {
  const currentColumnIndex = table.columns.findIndex((column) => column.id.wsId === columnId);
  const nextColumnIndex = currentColumnIndex + 1 < table.columns.length ? currentColumnIndex + 1 : 0;
  const previousColumnIndex = currentColumnIndex - 1 >= 0 ? currentColumnIndex - 1 : table.columns.length - 1;

  const currentColumn = table.columns[currentColumnIndex];
  const nextColumn = table.columns[nextColumnIndex];
  const previousColumn = table.columns[previousColumnIndex];

  const goToPreviousColumn = useCallback(() => {
    onSwitchColumn(previousColumn.id.wsId);
  }, [onSwitchColumn, previousColumn.id.wsId]);
  const goToNextColumn = useCallback(() => {
    onSwitchColumn(nextColumn.id.wsId);
  }, [onSwitchColumn, nextColumn.id.wsId]);

  useHotkeys(
    [
      ['ctrl + [', goToPreviousColumn],
      ['ctrl + ]', goToNextColumn],
    ],
    ['INPUT', 'TEXTAREA'],
  );

  return (
    <Group
      w={w ?? '100%'}
      h={h}
      style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}
      justify="space-between"
      align="center"
      p="2px 4px"
    >
      <ActionIcon variant="transparent" onClick={goToPreviousColumn}>
        <ChevronLeftIcon size={16} color="var(--mantine-color-gray-6)" />
      </ActionIcon>
      <TextRegularXs style={{ textTransform: 'uppercase' }}>{currentColumn?.name ?? 'unknown column'}</TextRegularXs>
      <ActionIcon variant="transparent" onClick={goToNextColumn}>
        <ChevronRightIcon size={16} color="var(--mantine-color-gray-6)" />
      </ActionIcon>
    </Group>
  );
};
