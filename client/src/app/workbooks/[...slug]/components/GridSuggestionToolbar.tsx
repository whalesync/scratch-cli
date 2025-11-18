import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { AcceptSuggestionButton, RejectSuggestionButton } from '@/app/components/base/buttons';
import { Text12Regular } from '@/app/components/base/text';
import MainContent from '@/app/components/layouts/MainContent';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { BoxProps, Group, Loader } from '@mantine/core';
import pluralize from 'pluralize';
import { JSX, useState } from 'react';
import { useWorkbookEditorUIStore } from '../../../../stores/workbook-editor-store';

type GridSuggestionToolbarProps = {
  table: SnapshotTable;
} & BoxProps;

export const GridSuggestionToolbar = (props: GridSuggestionToolbarProps): JSX.Element | null => {
  const { table, ...boxProps } = props;
  const workbookId = useWorkbookEditorUIStore((state) => state.workbookId);
  const { totalSuggestions, totalSuggestedDeletes, acceptAllSuggestions, rejectAllSuggestions, refreshRecords } =
    useSnapshotTableRecords({ workbookId, tableId: table.id });
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
            <Text12Regular>Saving...</Text12Regular>
          </>
        ) : (
          <Text12Regular style={{ fontStyle: 'italic', textTransform: 'uppercase' }}>
            {`//`} {totalSuggestions} {pluralize('change', totalSuggestions)} pending{' '}
            {totalSuggestedDeletes > 0
              ? `(${totalSuggestedDeletes} ${pluralize('record', totalSuggestedDeletes)} to deleted)`
              : ''}
          </Text12Regular>
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
