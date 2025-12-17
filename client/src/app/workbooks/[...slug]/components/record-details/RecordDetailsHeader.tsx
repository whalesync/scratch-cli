import { IconButtonInline, IconButtonOutline } from '@/app/components/base/buttons';
import { Text13Regular } from '@/app/components/base/text';
import { FieldErrorIcon } from '@/app/components/field-value-wrappers/FieldErrorIcon';
import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { formatFieldValue, TableSpec } from '@/types/server-entities/workbook';
import { Anchor, Breadcrumbs, Center, Group, Modal, StyleProp, Tooltip } from '@mantine/core';
import { useDisclosure, useHotkeys } from '@mantine/hooks';
import DOMPurify from 'dompurify';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  EyeIcon,
  PenOffIcon,
  TextAlignEndIcon,
  TextAlignJustifyIcon,
  XIcon,
} from 'lucide-react';
import htmlParser from 'prettier/plugins/html';
import prettier from 'prettier/standalone';
import { useCallback, useMemo } from 'react';
import { getGridOrderedColumnSpecs } from '../snapshot-grid/header-column-utils';

interface RecordDetailsHeaderProps {
  table: TableSpec;
  h?: StyleProp<React.CSSProperties['height']>;
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

  const handleFormatHtml = useCallback(async () => {
    if (!columnId || !onUpdateField || !record || !currentColumn) return;
    const currentValue = formatFieldValue(record.fields[columnId], currentColumn);
    try {
      const formatted = await prettier.format(currentValue || '', {
        parser: 'html',
        plugins: [htmlParser],
        printWidth: 80,
        tabWidth: 2,
      });
      onUpdateField(columnId, formatted.trim());
    } catch {
      // If formatting fails, leave as-is
    }
  }, [columnId, onUpdateField, record, currentColumn]);

  const handleMinifyHtml = useCallback(() => {
    if (!columnId || !onUpdateField || !record || !currentColumn) return;
    const currentValue = formatFieldValue(record.fields[columnId], currentColumn) || '';
    const minified = currentValue
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/>\s+</g, '><') // Remove whitespace between tags
      .replace(/\s+>/g, '>') // Remove whitespace before closing >
      .replace(/<\s+/g, '<') // Remove whitespace after opening <
      .trim();
    onUpdateField(columnId, minified);
  }, [columnId, onUpdateField, record, currentColumn]);

  const [previewOpened, { open: openPreview, close: closePreview }] = useDisclosure(false);

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
      {currentColumn?.metadata?.textFormat === 'html' && columnId && onUpdateField && record && (
        <>
          <Modal opened={previewOpened} onClose={closePreview} title="HTML Preview" size="xl" centered>
            <iframe
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:8px;font-family:system-ui,sans-serif;">${DOMPurify.sanitize(currentHtmlValue || '')}</body></html>`}
              style={{ width: '100%', height: 400, border: 'none' }}
              sandbox="allow-same-origin"
              title="HTML Preview"
            />
          </Modal>
          <Group gap={4}>
            <Tooltip label="Preview" position="bottom" withArrow>
              <IconButtonOutline size="compact-xs" onClick={openPreview}>
                <EyeIcon size={13} />
              </IconButtonOutline>
            </Tooltip>
            <Tooltip label="Prettify" position="bottom" withArrow>
              <IconButtonOutline size="compact-xs" onClick={handleFormatHtml}>
                <TextAlignEndIcon size={13} />
              </IconButtonOutline>
            </Tooltip>
            <Tooltip label="Minify" position="bottom" withArrow>
              <IconButtonOutline size="compact-xs" onClick={handleMinifyHtml}>
                <TextAlignJustifyIcon size={13} />
              </IconButtonOutline>
            </Tooltip>
          </Group>
        </>
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
