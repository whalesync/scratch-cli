import { Text12Regular } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { TableSpec } from '@/types/server-entities/workbook';
import { ActionIcon, Group, StyleProp } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { ChevronLeftIcon, ChevronRightIcon, Rows4Icon, XIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { getGridOrderedColumnSpecs } from '../snapshot-grid/header-column-utils';

interface RecordDetailsHeaderProps {
  table: TableSpec;
  w?: StyleProp<React.CSSProperties['width']>;
  h?: StyleProp<React.CSSProperties['height']>;
  columnId: string | undefined;
  onSwitchColumn: (columnId: string | undefined) => void;
  v2?: boolean;
  onClose?: () => void;
}

export const RecordDetailsHeader = ({
  table,
  w,
  h,
  columnId,
  onSwitchColumn,
  v2 = false,
  onClose,
}: RecordDetailsHeaderProps) => {
  // Order the columns like they appear in the grid view
  const orderedColumns = useMemo(() => {
    return getGridOrderedColumnSpecs(table);
  }, [table]);

  const { currentColumn, previousColumn, nextColumn } = useMemo(() => {
    if (columnId === undefined) {
      // if we are on the "all attributes" page, next is the first column and previous is the last column
      return {
        currentColumn: undefined,
        previousColumn: orderedColumns[orderedColumns.length - 1],
        nextColumn: orderedColumns[0],
      };
    }

    const currentColumnIndex = orderedColumns.findIndex((column) => column.id.wsId === columnId);
    let nextColumnIndex = -1;
    let previousColumnIndex = -1;

    // There is a fake page for "all attributes" that we need to cycle through and handle as a special case
    if (currentColumnIndex === 0) {
      nextColumnIndex = currentColumnIndex + 1 < orderedColumns.length ? currentColumnIndex + 1 : -1;
      previousColumnIndex = -1;
    } else if (currentColumnIndex === orderedColumns.length - 1) {
      nextColumnIndex = -1;
      previousColumnIndex = currentColumnIndex - 1 >= 0 ? currentColumnIndex - 1 : orderedColumns.length - 1;
    } else {
      nextColumnIndex = currentColumnIndex + 1 < orderedColumns.length ? currentColumnIndex + 1 : 0;
      previousColumnIndex = currentColumnIndex - 1 >= 0 ? currentColumnIndex - 1 : orderedColumns.length - 1;
    }
    return {
      currentColumn: orderedColumns[currentColumnIndex],
      previousColumn: previousColumnIndex !== -1 ? orderedColumns[previousColumnIndex] : undefined,
      nextColumn: nextColumnIndex !== -1 ? orderedColumns[nextColumnIndex] : undefined,
    };
  }, [orderedColumns, columnId]);

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

  return v2 ? (
    <Group
      w={w ?? '100%'}
      h={h}
      style={{ borderBottom: '1px solid light-dark(#c8ced5, var(--mantine-color-gray-2))' }}
      justify="space-between"
      align="center"
      p="2px 4px"
    >
      <Text12Regular style={{ textTransform: 'uppercase', paddingLeft: '8px' }}>
        {currentColumn?.name ?? 'all attributes'}
      </Text12Regular>
      <Group gap="xs" justify="flex-end">
        <Group gap="xs">
          <ActionIcon variant="transparent-hover" onClick={goToPreviousColumn} color="gray">
            <StyledLucideIcon Icon={ChevronLeftIcon} size={16} />
          </ActionIcon>
          <ActionIcon variant="transparent-hover" onClick={() => onSwitchColumn(undefined)} color="gray">
            <StyledLucideIcon Icon={Rows4Icon} size={16} />
          </ActionIcon>
          <ActionIcon variant="transparent-hover" onClick={goToNextColumn} color="gray">
            <StyledLucideIcon Icon={ChevronRightIcon} size={16} />
          </ActionIcon>
        </Group>
        <ActionIcon variant="transparent-hover" onClick={onClose} color="gray">
          <StyledLucideIcon Icon={XIcon} size={16} />
        </ActionIcon>
      </Group>
    </Group>
  ) : (
    <Group
      w={w ?? '100%'}
      h={h}
      style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}
      justify="space-between"
      align="center"
      p="2px 4px"
    >
      <Group gap="xs">
        <ActionIcon variant="transparent-hover" onClick={goToPreviousColumn} color="gray">
          <StyledLucideIcon Icon={ChevronLeftIcon} size={16} />
        </ActionIcon>
      </Group>
      <Text12Regular style={{ textTransform: 'uppercase' }}>{currentColumn?.name ?? 'all attributes'}</Text12Regular>
      <Group gap="xs" justify="flex-end">
        <ActionIcon variant="transparent-hover" onClick={() => onSwitchColumn(undefined)} color="gray">
          <StyledLucideIcon Icon={Rows4Icon} size={16} />
        </ActionIcon>
        <ActionIcon variant="transparent-hover" onClick={goToNextColumn} color="gray">
          <StyledLucideIcon Icon={ChevronRightIcon} size={16} />
        </ActionIcon>
      </Group>
    </Group>
  );
};
