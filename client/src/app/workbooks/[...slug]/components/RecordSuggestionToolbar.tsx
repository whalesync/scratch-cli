import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { Text12Regular, TextMono12Regular } from '@/app/components/base/text';
import MainContent from '@/app/components/layouts/MainContent';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { trackAcceptChanges, trackRejectChanges } from '@/lib/posthog';
import { SNAPSHOT_RECORD_DELETED_FIELD, SnapshotRecord, SnapshotTable } from '@/types/server-entities/workbook';
import { BoxProps, Group, Loader } from '@mantine/core';
import pluralize from 'pluralize';
import { JSX, useMemo, useState } from 'react';
import { useActiveWorkbook } from '../../../../hooks/use-active-workbook';

export const RECORD_SUGGESTION_TOOLBAR_HEIGHT = 40;

type RecordSuggestionToolbarProps = {
  table: SnapshotTable;
  record: SnapshotRecord;
  columnId?: string; // if provided, only work with suggestions for this column
} & BoxProps;

interface SuggestionItem {
  columnId: string;
  columnName: string;
  currentValue: string;
  suggestedValue: string;
}

export const RecordSuggestionToolbar = (props: RecordSuggestionToolbarProps): JSX.Element | null => {
  const { table, record, columnId, ...boxProps } = props;
  const { workbook } = useActiveWorkbook();
  const { acceptCellValues, rejectCellValues, refreshRecords } = useSnapshotTableRecords({
    workbookId: workbook?.id ?? null,
    tableId: table.id,
  });
  const [saving, setSaving] = useState(false);

  const suggestions: SuggestionItem[] = useMemo(() => {
    return Object.entries(record.__suggested_values ?? {})
      .filter(([colId]) => !columnId || columnId === colId) // if columnId is provided, only show suggestions for that column
      .map(([colId, suggestedValue]) => ({
        columnId: colId,
        columnName: table.tableSpec.columns.find((c) => c.id.wsId === colId)?.name ?? '',
        currentValue: record.fields[colId] as string,
        suggestedValue: suggestedValue as string,
      }));
  }, [record, table, columnId]);

  const handleAcceptSuggestions = async () => {
    if (suggestions.length === 0) return;
    try {
      setSaving(true);

      const itemsToAccept = suggestions.map((suggestion) => ({
        wsId: record.id.wsId,
        columnId: suggestion.columnId,
      }));

      await acceptCellValues(itemsToAccept);
      trackAcceptChanges(itemsToAccept, workbook);
      ScratchpadNotifications.success({
        title: 'Suggestions Accepted',
        message: `Accepted ${itemsToAccept.length} ${pluralize('change', itemsToAccept.length)}`,
      });
      await refreshRecords();
    } catch (error) {
      console.error('Error accepting suggestions:', error);
      ScratchpadNotifications.error({
        title: 'Error accepting suggestions',
        message: error instanceof Error ? error.message : 'Failed to accept suggestions for this record',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRejectSuggestions = async () => {
    if (suggestions.length === 0) return;
    try {
      setSaving(true);
      const itemsToReject = suggestions.map((suggestion) => ({
        wsId: record.id.wsId,
        columnId: suggestion.columnId,
      }));
      await rejectCellValues(itemsToReject);
      trackRejectChanges(itemsToReject, workbook);
      ScratchpadNotifications.success({
        title: 'Suggestions Rejected',
        message: `Rejected ${itemsToReject.length} ${pluralize('change', itemsToReject.length)}`,
      });
      await refreshRecords();
    } catch (error) {
      console.error('Error rejecting suggestions:', error);
      ScratchpadNotifications.error({
        title: 'Error rejecting suggestions',
        message: error instanceof Error ? error.message : 'Failed to reject suggestions for this record',
      });
    } finally {
      setSaving(false);
    }
  };

  if (suggestions.length === 0) {
    return null;
  }

  const suggestionContainsDelete = suggestions.some(
    (suggestion) => suggestion.columnId === SNAPSHOT_RECORD_DELETED_FIELD,
  );

  let suggestionLabel = <></>;
  if (saving) {
    suggestionLabel = (
      <>
        <Loader size="xs" /> <Text12Regular>Saving...</Text12Regular>
      </>
    );
  } else if (suggestionContainsDelete) {
    suggestionLabel = (
      <TextMono12Regular style={{ fontStyle: 'italic', textTransform: 'uppercase' }}>
        {`//`} Pending delete
      </TextMono12Regular>
    );
  } else if (suggestions.length === 1 && columnId) {
    suggestionLabel = (
      <TextMono12Regular style={{ fontStyle: 'italic', textTransform: 'uppercase' }}>
        {`//`} {suggestions.length} {pluralize('change', suggestions.length)} pending in cell
      </TextMono12Regular>
    );
  } else {
    suggestionLabel = (
      <TextMono12Regular style={{ fontStyle: 'italic', textTransform: 'uppercase' }}>
        {`//`} {suggestions.length} {pluralize('change', suggestions.length)} pending in record
      </TextMono12Regular>
    );
  }

  return (
    <MainContent.Footer {...boxProps} h={RECORD_SUGGESTION_TOOLBAR_HEIGHT}>
      <Group h="100%" align="center" px="sm">
        {suggestionLabel}
        <Group ml="auto">
          <ButtonSecondaryOutline size="compact-xs" onClick={handleRejectSuggestions} loading={saving}>
            Reject
          </ButtonSecondaryOutline>
          <ButtonPrimaryLight size="compact-xs" onClick={handleAcceptSuggestions} loading={saving}>
            Accept
          </ButtonPrimaryLight>
        </Group>
      </Group>
    </MainContent.Footer>
  );
};
