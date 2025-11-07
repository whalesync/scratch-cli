import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { AcceptSuggestionButton, RejectSuggestionButton } from '@/app/components/base/buttons';
import { TextXsRegular } from '@/app/components/base/text';
import MainContent from '@/app/components/layouts/MainContent';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { trackAcceptChanges, trackRejectChanges } from '@/lib/posthog';
import { SNAPSHOT_RECORD_DELETED_FIELD, SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { BoxProps, Group, Loader } from '@mantine/core';
import pluralize from 'pluralize';
import { JSX, useMemo, useState } from 'react';
import { useSnapshotContext } from './contexts/SnapshotContext';

type RecordSuggestionToolbarProps = {
  table: TableSpec;
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
  const { snapshot } = useSnapshotContext();
  const { acceptCellValues, rejectCellValues, refreshRecords } = useSnapshotTableRecords({
    snapshotId: snapshot?.id ?? '',
    tableId: table.id.wsId,
  });
  const [saving, setSaving] = useState(false);

  const suggestions: SuggestionItem[] = useMemo(() => {
    return Object.entries(record.__suggested_values ?? {})
      .filter(([colId]) => !columnId || columnId === colId) // if columnId is provided, only show suggestions for that column
      .map(([colId, suggestedValue]) => ({
        columnId: colId,
        columnName: table.columns.find((c) => c.id.wsId === colId)?.name ?? '',
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
      trackAcceptChanges(itemsToAccept, snapshot);
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
      trackRejectChanges(itemsToReject, snapshot);
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
        <Loader size="xs" /> <TextXsRegular>Saving...</TextXsRegular>
      </>
    );
  } else if (suggestionContainsDelete) {
    suggestionLabel = (
      <TextXsRegular style={{ fontStyle: 'italic', textTransform: 'uppercase' }}>{`//`} Pending delete</TextXsRegular>
    );
  } else if (suggestions.length === 1 && columnId) {
    suggestionLabel = (
      <TextXsRegular style={{ fontStyle: 'italic', textTransform: 'uppercase' }}>
        {`//`} {suggestions.length} {pluralize('change', suggestions.length)} pending in cell
      </TextXsRegular>
    );
  } else {
    suggestionLabel = (
      <TextXsRegular style={{ fontStyle: 'italic', textTransform: 'uppercase' }}>
        {`//`} {suggestions.length} {pluralize('change', suggestions.length)} pending in record
      </TextXsRegular>
    );
  }

  return (
    <MainContent.Footer {...boxProps}>
      <Group h="100%" align="center">
        {suggestionLabel}
        <Group ml="auto">
          <RejectSuggestionButton size="xs" onClick={handleRejectSuggestions} loading={saving}>
            Reject
          </RejectSuggestionButton>
          <AcceptSuggestionButton size="xs" onClick={handleAcceptSuggestions} loading={saving}>
            Accept
          </AcceptSuggestionButton>
        </Group>
      </Group>
    </MainContent.Footer>
  );
};
