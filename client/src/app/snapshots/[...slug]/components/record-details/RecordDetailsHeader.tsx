import { TextRegularXs } from '@/app/components/base/text';
import { TableSpec } from '@/types/server-entities/snapshot';
import { ActionIcon, Group, StyleProp } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { ChevronLeftIcon, ChevronRightIcon, Rows4Icon } from 'lucide-react';
import { useCallback, useMemo } from 'react';

interface RecordDetailsHeaderProps {
  table: TableSpec;
  w?: StyleProp<React.CSSProperties['width']>;
  h?: StyleProp<React.CSSProperties['height']>;
  columnId: string | undefined;
  onSwitchColumn: (columnId: string | undefined) => void;
}

export const RecordDetailsHeader = ({ table, w, h, columnId, onSwitchColumn }: RecordDetailsHeaderProps) => {
  const { currentColumn, previousColumn, nextColumn } = useMemo(() => {
    if (columnId === undefined) {
      // if we are on the "all attributes" page, next is the first column and previous is the last column
      return {
        currentColumn: undefined,
        previousColumn: table.columns[table.columns.length - 1],
        nextColumn: table.columns[0],
      };
    }

    const currentColumnIndex = table.columns.findIndex((column) => column.id.wsId === columnId);
    let nextColumnIndex = -1;
    let previousColumnIndex = -1;

    // There is a fake page for "all attributes" that we need to cycle through and handle as a special case
    if (currentColumnIndex === 0) {
      nextColumnIndex = currentColumnIndex + 1 < table.columns.length ? currentColumnIndex + 1 : -1;
      previousColumnIndex = -1;
    } else if (currentColumnIndex === table.columns.length - 1) {
      nextColumnIndex = -1;
      previousColumnIndex = currentColumnIndex - 1 >= 0 ? currentColumnIndex - 1 : table.columns.length - 1;
    } else {
      nextColumnIndex = currentColumnIndex + 1 < table.columns.length ? currentColumnIndex + 1 : 0;
      previousColumnIndex = currentColumnIndex - 1 >= 0 ? currentColumnIndex - 1 : table.columns.length - 1;
    }
    return {
      currentColumn: table.columns[currentColumnIndex],
      previousColumn: previousColumnIndex !== -1 ? table.columns[previousColumnIndex] : undefined,
      nextColumn: nextColumnIndex !== -1 ? table.columns[nextColumnIndex] : undefined,
    };
  }, [table, columnId]);

  const goToPreviousColumn = useCallback(() => {
    onSwitchColumn(previousColumn?.id.wsId);
  }, [onSwitchColumn, previousColumn?.id.wsId]);

  const goToNextColumn = useCallback(() => {
    onSwitchColumn(nextColumn?.id.wsId);
  }, [onSwitchColumn, nextColumn?.id.wsId]);

  useHotkeys(
    [
      ['arrowleft', goToPreviousColumn],
      ['arrowright', goToNextColumn],
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
      <Group gap="xs">
        <ActionIcon variant="transparent" onClick={goToPreviousColumn}>
          <ChevronLeftIcon size={16} color="var(--mantine-color-gray-6)" />
        </ActionIcon>
      </Group>
      <TextRegularXs style={{ textTransform: 'uppercase' }}>{currentColumn?.name ?? 'all attributes'}</TextRegularXs>
      <Group gap="xs" justify="flex-end">
        <ActionIcon variant="transparent" onClick={() => onSwitchColumn(undefined)}>
          <Rows4Icon size={16} color="var(--mantine-color-gray-6)" />
        </ActionIcon>
        <ActionIcon variant="transparent" onClick={goToNextColumn}>
          <ChevronRightIcon size={16} color="var(--mantine-color-gray-6)" />
        </ActionIcon>
      </Group>
    </Group>
  );
};
