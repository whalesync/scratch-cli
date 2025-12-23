import { IconButtonInline } from '@/app/components/base/buttons';
import { Text13Regular } from '@/app/components/base/text';
import { FieldErrorIcon } from '@/app/components/field-value-wrappers/FieldErrorIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { isSideBySideMode } from '@/app/workbooks/[...slug]/components/helpers';
import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { formatFieldValue } from '@/types/server-entities/workbook';
import { Anchor, Breadcrumbs, Center, Group, StyleProp, Tooltip } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { TableSpec } from '@spinner/shared-types';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  Columns2Icon,
  PenOffIcon,
  XIcon,
} from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { getGridOrderedColumnSpecs } from '../snapshot-grid/header-column-utils';
import { RecordDetailsMode } from '../types';
import { HtmlActionButtons } from './HtmlActionButtons';

interface RecordDetailsHeaderProps {
  table: TableSpec;
  h?: StyleProp<React.CSSProperties['height']>;
  mode: RecordDetailsMode;
  onToggleMode: () => void;
  columnId: string | undefined;
  onSwitchColumn: (columnId: string | undefined) => void;
  v2?: boolean;
  onClose?: () => void;
  hiddenColumns: string[];
  record?: ProcessedSnapshotRecord;
  onUpdateField?: (columnId: string, value: string) => void;
}

export const RecordDetailsHeader = ({
  table,
  h,
  mode,
  onToggleMode,
  columnId,
  onSwitchColumn,
  onClose,
  hiddenColumns,
  record,
  onUpdateField,
}: RecordDetailsHeaderProps) => {
  // Order the columns like they appear in the grid view
  const orderedColumns = useMemo(() => getGridOrderedColumnSpecs(table, hiddenColumns).columns, [table, hiddenColumns]);

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

  const currentHtmlValue =
    columnId && record && currentColumn ? formatFieldValue(record.fields[columnId], currentColumn) : '';

  return (
    <Group w="100%" h={h} style={{ borderBottom: '0.5px solid var(--fg-divider)' }} align="center" gap={0} px="xs">
      {/* Centered ignoring the buttons */}
      <Center pos="absolute" left={0} right={0} c="var(--fg-secondary)">
        {currentColumn ? (
          <Breadcrumbs separator={<ChevronRightIcon size={13} />}>
            <Anchor fz="13px" c="var(--fg-secondary)" onClick={() => onSwitchColumn(undefined)}>
              All fields
            </Anchor>
            <Group gap={4} align="center" wrap="nowrap">
              <Text13Regular>{currentColumn.name}</Text13Regular>
              {record && <FieldErrorIcon record={record} columnDef={currentColumn} />}
              {currentColumn.readonly && (
                <Tooltip label="This field is readonly" position="top" withArrow>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <PenOffIcon size={12} />
                  </span>
                </Tooltip>
              )}
            </Group>
          </Breadcrumbs>
        ) : (
          <Text13Regular>All fields</Text13Regular>
        )}
      </Center>
      <IconButtonInline mr="auto" onClick={() => onClose?.()}>
        <XIcon size={13} />
      </IconButtonInline>
      {currentColumn?.metadata?.textFormat === 'html' &&
        columnId &&
        onUpdateField &&
        record &&
        !isSideBySideMode(mode) && (
          <HtmlActionButtons
            value={currentHtmlValue}
            onUpdate={(value) => onUpdateField(columnId, value)}
            disabled={currentColumn.readonly}
          />
        )}
      {columnId && record?.__suggested_values && Object.keys(record?.__suggested_values || {}).length > 0 && (
        <Tooltip label="Toggle side-by-side view" position="bottom" withArrow>
          <IconButtonInline
            onClick={onToggleMode}
            data-active={isSideBySideMode(mode) || undefined}
            style={{
              backgroundColor: isSideBySideMode(mode) ? 'var(--bg-selected)' : undefined,
              color: isSideBySideMode(mode) ? 'var(--fg-primary)' : undefined,
            }}
          >
            <StyledLucideIcon Icon={Columns2Icon} size={13} />
          </IconButtonInline>
        </Tooltip>
      )}

      <IconButtonInline onClick={goToPreviousColumn}>
        <ArrowLeftIcon size={13} />
      </IconButtonInline>
      <IconButtonInline onClick={goToNextColumn}>
        <ArrowRightIcon size={13} />
      </IconButtonInline>
    </Group>
  );
};
