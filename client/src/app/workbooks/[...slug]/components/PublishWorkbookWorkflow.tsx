import { PublishJobProgressModal } from '@/app/components/jobs/publish/PublishJobProgressModal';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { TableSelectorModal2 } from '@/app/components/TableSelectorModal2';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { workbookApi } from '@/lib/api/workbook';
import { serviceName } from '@/service-naming-conventions';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { useState } from 'react';
import { PublishConfirmationModal } from './snapshot-grid/modals/PublishConfirmationModal';

/**
 * A container component that handles the publish workflow and the modals involved. Triggered through the WorkbookEditorUIStore
 */
export const PublishWorkbookWorkflow = () => {
  const { workbook, activeTable } = useActiveWorkbook();
  const publishConfirmationOpen = useWorkbookEditorUIStore((state) => state.publishConfirmationOpen);
  const closePublishConfirmation = useWorkbookEditorUIStore((state) => state.closePublishConfirmation);
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [showPublishConfirmation, setShowPublishConfirmation] = useState(false);
  const [selectedPublishTableIds, setSelectedPublishTableIds] = useState<string[]>([]);
  const [publishInProgress, setPublishInProgress] = useState<{ jobId: string } | null>(null);

  // When the store's publishConfirmationOpen changes to true, show the table selector
  if (publishConfirmationOpen && !showTableSelector && !showPublishConfirmation) {
    setShowTableSelector(true);
    closePublishConfirmation(); // Close the store's flag immediately
  }

  const handleTablesSelectedForPublish = (tableIds: string[]) => {
    setSelectedPublishTableIds(tableIds);
    setShowTableSelector(false);
    setShowPublishConfirmation(true);
  };

  const handleConfirmPublish = async () => {
    if (!workbook) return;

    try {
      setShowPublishConfirmation(false);
      const result = await workbookApi.publish(workbook.id, selectedPublishTableIds);
      setPublishInProgress(result);
    } catch (e) {
      console.debug(e);
      ScratchpadNotifications.error({
        title: 'Publish failed',
        message: (e as Error).message ?? 'There was an error publishing your data',
        autoClose: 5000,
      });
    }
  };

  // if (!workbook || !activeTable) {
  //   return null;
  // }

  return (
    <>
      {workbook && activeTable && showTableSelector && (
        <TableSelectorModal2
          isOpen={showTableSelector}
          onClose={() => setShowTableSelector(false)}
          onConfirm={handleTablesSelectedForPublish}
          tables={workbook.snapshotTables || []}
          currentTableId={activeTable.id}
          title="Select tables to publish"
          description="Select the tables you want to publish:"
          // confirmButtonText="Continue"
          workbookId={workbook.id}
        />
      )}
      {workbook && activeTable && showPublishConfirmation && (
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

      {publishInProgress && (
        <PublishJobProgressModal jobId={publishInProgress.jobId} onClose={() => setPublishInProgress(null)} />
      )}
    </>
  );
};
