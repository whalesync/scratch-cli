import { PublishJobProgressModal } from '@/app/components/jobs/publish/PublishJobProgressModal';
import { TableSelectorModal } from '@/app/components/modals/TableSelectorModal';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { PublishLimitExceededModal } from '@/app/workbooks/[...slug]/components/snapshot-grid/modals/PublishLimitExceededModal';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useSubscription } from '@/hooks/use-subscription';
import { workbookApi } from '@/lib/api/workbook';
import { serviceName } from '@/service-naming-conventions';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { hasDeletedConnection } from '@/types/server-entities/workbook';
import { useCallback, useState } from 'react';
import { PublishConfirmationModal } from './snapshot-grid/modals/PublishConfirmationModal';

/**
 * A container component that handles the publish workflow and the modals involved. Triggered through the WorkbookEditorUIStore
 */
export const PublishWorkbookWorkflow = () => {
  const { workbook, activeTable, refreshWorkbook } = useActiveWorkbook();
  const workbookMode = useWorkbookEditorUIStore((state) => state.workbookMode);
  const publishConfirmationOpen = useWorkbookEditorUIStore((state) => state.publishConfirmationOpen);
  const preselectedPublishTableIds = useWorkbookEditorUIStore((state) => state.preselectedPublishTableIds);
  const closePublishConfirmation = useWorkbookEditorUIStore((state) => state.closePublishConfirmation);
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [showPublishConfirmation, setShowPublishConfirmation] = useState(false);
  const [selectedPublishTableIds, setSelectedPublishTableIds] = useState<string[]>([]);
  const [initialSelectedTableIds, setInitialSelectedTableIds] = useState<string[] | undefined>(undefined);
  const [publishInProgress, setPublishInProgress] = useState<{ jobId: string } | null>(null);
  const [limitExceeded, setLimitExceeded] = useState(false);
  const { canPublishWorkbook } = useSubscription();

  // When the store's publishConfirmationOpen changes to true, show the table selector
  if (publishConfirmationOpen && !showTableSelector && !showPublishConfirmation) {
    setShowTableSelector(true);
    setInitialSelectedTableIds(preselectedPublishTableIds ?? undefined);
    closePublishConfirmation(); // Close the store's flag immediately
  }

  const handleTablesSelectedForPublish = (tableIds: string[]) => {
    setSelectedPublishTableIds(tableIds);
    setShowTableSelector(false);
    setShowPublishConfirmation(true);
  };

  const handleTableSelectorClose = () => {
    setShowTableSelector(false);
    setInitialSelectedTableIds(undefined);
  };

  const handleConfirmPublish = useCallback(async () => {
    setLimitExceeded(false);
    if (!workbook) return;
    if (!canPublishWorkbook) {
      setLimitExceeded(true);
      return;
    }
    try {
      setShowPublishConfirmation(false);

      const result =
        workbookMode === 'files'
          ? await workbookApi.publishFiles(workbook.id, selectedPublishTableIds)
          : await workbookApi.publish(workbook.id, selectedPublishTableIds);
      setPublishInProgress(result);
    } catch (e) {
      console.debug(e);
      ScratchpadNotifications.error({
        title: 'Publish failed',
        message: (e as Error).message ?? 'There was an error publishing your data',
        autoClose: 5000,
      });
    }
  }, [workbook, selectedPublishTableIds, canPublishWorkbook, workbookMode]);

  const handlePublishComplete = useCallback(async () => {
    setPublishInProgress(null);
    setInitialSelectedTableIds(undefined);
    // Ensure the workbook is refreshed to reflect the changes to sync status on all the published tables
    await refreshWorkbook();
  }, [refreshWorkbook, setPublishInProgress]);

  return (
    <>
      {workbook && activeTable && showTableSelector && (
        <TableSelectorModal
          isOpen={showTableSelector}
          onClose={handleTableSelectorClose}
          onConfirm={handleTablesSelectedForPublish}
          tables={workbook.snapshotTables?.filter((table) => !hasDeletedConnection(table)) || []}
          currentTableId={activeTable.id}
          initialSelectedTableIds={initialSelectedTableIds}
          title="Select tables to publish"
          workbookId={workbook.id}
        />
      )}
      {workbook && activeTable && showPublishConfirmation && !limitExceeded && (
        <PublishConfirmationModal
          isOpen={showPublishConfirmation}
          onClose={() => setShowPublishConfirmation(false)}
          onConfirm={handleConfirmPublish}
          workbookId={workbook.id}
          serviceName={activeTable.connectorService ? serviceName(activeTable.connectorService) : undefined}
          isPublishing={false}
          snapshotTableIds={selectedPublishTableIds}
          snapshotTables={workbook.snapshotTables ?? []}
        />
      )}
      {limitExceeded && activeTable && (
        <PublishLimitExceededModal
          isOpen={limitExceeded}
          onClose={() => {
            setLimitExceeded(false);
            setShowPublishConfirmation(false);
          }}
          serviceName={activeTable.connectorService ? serviceName(activeTable.connectorService) : undefined}
        />
      )}
      {publishInProgress && <PublishJobProgressModal jobId={publishInProgress.jobId} onClose={handlePublishComplete} />}
    </>
  );
};
