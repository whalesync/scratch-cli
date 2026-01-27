import { Command } from '@/app/components/AdvancedAgentInput/CommandSuggestions';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useAgentChatContext } from '@/app/workbooks/[...slug]/components/contexts/agent-chat-context';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { SnapshotTableId } from '@spinner/shared-types';
import pluralize from 'pluralize';
import { useMemo } from 'react';

interface UseDataAgentCommandsOptions {
  setShowToolsModal: (show: boolean) => void;
}

export function useDataAgentCommands({ setShowToolsModal }: UseDataAgentCommandsOptions): Command[] {
  const { workbook, activeTable } = useActiveWorkbook();
  const { dataScope, activeRecordId } = useAgentChatContext();
  const openPublishConfirmation = useWorkbookEditorUIStore((state) => state.openPublishConfirmation);

  const { records, acceptAllSuggestions, rejectAllSuggestions, acceptCellValues, rejectCellValues, refreshRecords } =
    useSnapshotTableRecords({
      workbookId: workbook?.id ?? null,
      tableId: (activeTable?.id as SnapshotTableId) ?? null,
    });

  const handlePublish = () => {
    if (!workbook) return;
    openPublishConfirmation();
  };

  return useMemo(() => {
    const commands: Command[] = [
      {
        id: 'cmd1',
        display: 'tools',
        description: 'Open tools modal',
        execute: () => setShowToolsModal(true),
      },
      {
        id: 'cmd2',
        display: 'publish',
        description: 'Publish data to remote service',
        execute: () => handlePublish(),
      },
      {
        id: 'cmd3',
        display: '/',
        description: 'Revert last action',
        execute: () => {
          console.debug('TODO: Implement revert last action logic');
        },
      },
      {
        id: 'cmd4',
        display: 'acceptAll',
        description: 'Accept all suggestions in table',
        execute: async () => {
          try {
            const { recordsUpdated, totalChangesAccepted } = await acceptAllSuggestions();
            ScratchpadNotifications.success({
              title: 'Suggestions Accepted',
              message: `Accepted ${totalChangesAccepted} ${pluralize('change', totalChangesAccepted)} for ${recordsUpdated} ${pluralize('record', recordsUpdated)} in the table`,
            });
            await refreshRecords();
          } catch (error) {
            ScratchpadNotifications.error({
              title: 'Error Accepting Suggestions',
              message: error instanceof Error ? error.message : 'Failed to accept all suggestions',
            });
          }
        },
      },
      {
        id: 'cmd5',
        display: 'rejectAll',
        description: 'Reject all suggestions in table',
        execute: async () => {
          try {
            const { recordsRejected, totalChangesRejected } = await rejectAllSuggestions();
            ScratchpadNotifications.success({
              title: 'Suggestions Rejected',
              message: `Rejected ${totalChangesRejected} ${pluralize('change', totalChangesRejected)} for ${recordsRejected} ${pluralize('record', recordsRejected)} in the table`,
            });
            await refreshRecords();
          } catch (error) {
            ScratchpadNotifications.error({
              title: 'Error Rejecting Suggestions',
              message: error instanceof Error ? error.message : 'Failed to reject all suggestions',
            });
          }
        },
      },
    ];

    // Only add accept/reject commands in record view
    if (dataScope === 'record' && activeRecordId) {
      commands.push(
        {
          id: 'cmd6',
          display: 'accept',
          description: 'Accept suggestions for current record',
          execute: async () => {
            const record = records?.find((r) => r.id.wsId === activeRecordId);
            if (!record) {
              ScratchpadNotifications.error({
                title: 'Record Not Found',
                message: 'Could not find the current record',
              });
              return;
            }

            const suggestions = Object.entries(record.__suggested_values ?? {});
            if (suggestions.length === 0) {
              ScratchpadNotifications.info({
                title: 'No Suggestions',
                message: 'This record has no pending suggestions',
              });
              return;
            }

            try {
              const itemsToAccept = suggestions.map(([columnId]) => ({
                wsId: record.id.wsId,
                columnId,
              }));

              await acceptCellValues(itemsToAccept);
              ScratchpadNotifications.success({
                title: 'Suggestions Accepted',
                message: `Accepted ${itemsToAccept.length} ${pluralize('change', itemsToAccept.length)}`,
              });
              await refreshRecords();
            } catch (error) {
              ScratchpadNotifications.error({
                title: 'Error Accepting Suggestions',
                message: error instanceof Error ? error.message : 'Failed to accept suggestions for this record',
              });
            }
          },
        },
        {
          id: 'cmd7',
          display: 'reject',
          description: 'Reject suggestions for current record',
          execute: async () => {
            const record = records?.find((r) => r.id.wsId === activeRecordId);
            if (!record) {
              ScratchpadNotifications.error({
                title: 'Record Not Found',
                message: 'Could not find the current record',
              });
              return;
            }

            const suggestions = Object.entries(record.__suggested_values ?? {});
            if (suggestions.length === 0) {
              ScratchpadNotifications.info({
                title: 'No Suggestions',
                message: 'This record has no pending suggestions',
              });
              return;
            }

            try {
              const itemsToReject = suggestions.map(([columnId]) => ({
                wsId: record.id.wsId,
                columnId,
              }));

              await rejectCellValues(itemsToReject);
              ScratchpadNotifications.success({
                title: 'Suggestions Rejected',
                message: `Rejected ${itemsToReject.length} ${pluralize('change', itemsToReject.length)}`,
              });
              await refreshRecords();
            } catch (error) {
              ScratchpadNotifications.error({
                title: 'Error Rejecting Suggestions',
                message: error instanceof Error ? error.message : 'Failed to reject suggestions for this record',
              });
            }
          },
        },
      );
    }

    return commands;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dataScope,
    activeRecordId,
    records,
    setShowToolsModal,
    acceptAllSuggestions,
    rejectAllSuggestions,
    acceptCellValues,
    rejectCellValues,
    refreshRecords,
    workbook,
    openPublishConfirmation,
  ]);
}
