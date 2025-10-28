import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { AcceptSuggestionButton, RejectSuggestionButton } from '@/app/components/base/buttons';
import { TextXsRegular } from '@/app/components/base/text';
import MainContent from '@/app/components/layouts/MainContent';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { TableSpec } from '@/types/server-entities/snapshot';
import { BoxProps, Group, Loader } from '@mantine/core';
import pluralize from 'pluralize';
import { JSX, useState } from 'react';
import { useSnapshotContext } from './contexts/SnapshotContext';

type GridSuggestionToolbarProps = {
  table: TableSpec;
} & BoxProps;

export const GridSuggestionToolbar = (props: GridSuggestionToolbarProps): JSX.Element | null => {
  const { table, ...boxProps } = props;
  const { snapshot, currentViewId, viewDataAsAgent } = useSnapshotContext();
  const { totalSuggestions, totalSuggestedDeletes, acceptAllSuggestions, rejectAllSuggestions, refreshRecords } =
    useSnapshotTableRecords({
      snapshotId: snapshot?.id ?? '',
      tableId: table.id.wsId,
      viewId: viewDataAsAgent && currentViewId ? currentViewId : undefined,
    });
  const [saving, setSaving] = useState(false);

  const handleAcceptAllSuggestions = async () => {
    try {
      setSaving(true);
      const { recordsUpdated, totalChangesAccepted } = await acceptAllSuggestions();
      ScratchpadNotifications.success({
        title: 'Suggestions Accepted',
        message: `Accepted ${totalChangesAccepted} ${pluralize('change', totalChangesAccepted)} for ${recordsUpdated} ${pluralize('record', recordsUpdated)} in the table`,
      });
      await refreshRecords();
    } catch (error) {
      console.error('Error accepting all suggestions:', error);
      ScratchpadNotifications.error({
        title: 'Error Accepting Suggestions',
        message: error instanceof Error ? error.message : 'Failed to accept all suggestions',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRejectAllSuggestions = async () => {
    try {
      setSaving(true);
      const { recordsRejected, totalChangesRejected } = await rejectAllSuggestions();
      ScratchpadNotifications.success({
        title: 'Suggestions Rejected',
        message: `Rejected ${totalChangesRejected} ${pluralize('change', totalChangesRejected)} for ${recordsRejected} ${pluralize('record', recordsRejected)} in the table`,
      });
      await refreshRecords();
    } catch (error) {
      console.error('Error accepting all suggestions:', error);
      ScratchpadNotifications.error({
        title: 'Error Accepting Suggestions',
        message: error instanceof Error ? error.message : 'Failed to reject all suggestions',
      });
    } finally {
      setSaving(false);
    }
  };

  if (totalSuggestions === 0) {
    return null;
  }

  return (
    <MainContent.Footer {...boxProps}>
      <Group h="100%" align="center">
        {saving ? (
          <>
            <Loader size="xs" />
            <TextXsRegular>Saving...</TextXsRegular>
          </>
        ) : (
          <TextXsRegular style={{ fontStyle: 'italic', textTransform: 'uppercase' }}>
            {`//`} {totalSuggestions} {pluralize('change', totalSuggestions)} pending{' '}
            {totalSuggestedDeletes > 0
              ? `(${totalSuggestedDeletes} ${pluralize('record', totalSuggestedDeletes)} to deleted)`
              : ''}
          </TextXsRegular>
        )}
        <Group ml="auto">
          <RejectSuggestionButton size="xs" onClick={handleRejectAllSuggestions} loading={saving}>
            Reject all
          </RejectSuggestionButton>
          <AcceptSuggestionButton size="xs" onClick={handleAcceptAllSuggestions} loading={saving}>
            Accept all
          </AcceptSuggestionButton>
        </Group>
      </Group>
    </MainContent.Footer>
  );
};
