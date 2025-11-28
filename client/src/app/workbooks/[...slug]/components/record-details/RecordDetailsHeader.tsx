import { IconButtonInline } from '@/app/components/base/buttons';
import { Text13Regular } from '@/app/components/base/text';
import { TableSpec } from '@/types/server-entities/workbook';
import { Anchor, Breadcrumbs, Center, Group, StyleProp } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { ArrowLeftIcon, ArrowRightIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { getGridOrderedColumnSpecs } from '../snapshot-grid/header-column-utils';

interface RecordDetailsHeaderProps {
  table: TableSpec;
  h?: StyleProp<React.CSSProperties['height']>;
  columnId: string | undefined;
  onSwitchColumn: (columnId: string | undefined) => void;
  v2?: boolean;
  onClose?: () => void;
}

export const RecordDetailsHeader = ({ table, h, columnId, onSwitchColumn, onClose }: RecordDetailsHeaderProps) => {
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

  return (
    <Group
      w="100%"
      h={h}
      style={{ borderBottom: '1px solid light-dark(#c8ced5, var(--mantine-color-gray-2))' }}
      align="center"
      gap={0}
      px="xs"
    >
      {/* Centered ignoring the buttons */}
      <Center pos="absolute" left={0} right={0} c="var(--fg-secondary)">
        {currentColumn ? (
          <Breadcrumbs separator={<ChevronRightIcon size={13} />}>
            <Anchor fz="13px" c="var(--fg-secondary)" onClick={() => onSwitchColumn(undefined)}>
              All fields
            </Anchor>
            <Text13Regular>{currentColumn.name}</Text13Regular>
          </Breadcrumbs>
        ) : (
          <Text13Regular>All fields</Text13Regular>
        )}
      </Center>
      <IconButtonInline mr="auto" onClick={() => onClose?.()}>
        <XIcon size={13} />
      </IconButtonInline>
      <IconButtonInline onClick={goToPreviousColumn}>
        <ArrowLeftIcon size={13} />
      </IconButtonInline>
      <IconButtonInline onClick={goToNextColumn}>
        <ArrowRightIcon size={13} />
      </IconButtonInline>
    </Group>
  );
};
