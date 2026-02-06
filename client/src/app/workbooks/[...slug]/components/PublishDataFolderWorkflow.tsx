import { PublishJobProgressModal } from '@/app/components/jobs/publish/PublishJobProgressModal';
import { DataFolderSelectorModal } from '@/app/components/modals/DataFolderSelectorModal';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useSubscription } from '@/hooks/use-subscription';
import { dataFolderApi } from '@/lib/api/data-folder';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { DataFolderId } from '@spinner/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { PublishLimitExceededModal } from './modals/PublishLimitExceededModal';

/**
 * A container component that handles the data folder publish workflow and the modals involved.
 * Triggered through the WorkbookEditorUIStore.
 */
export const PublishDataFolderWorkflow = () => {
  const { workbook, refreshWorkbook } = useActiveWorkbook();
  const dataFolderPublishConfirmationOpen = useWorkbookEditorUIStore(
    (state) => state.dataFolderPublishConfirmationOpen,
  );
  const preselectedPublishDataFolderIds = useWorkbookEditorUIStore((state) => state.preselectedPublishDataFolderIds);
  const closeDataFolderPublishConfirmation = useWorkbookEditorUIStore(
    (state) => state.closeDataFolderPublishConfirmation,
  );
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [initialSelectedFolderIds, setInitialSelectedFolderIds] = useState<DataFolderId[] | undefined>(undefined);
  const [publishInProgress, setPublishInProgress] = useState<{ jobId: string } | null>(null);
  const [limitExceeded, setLimitExceeded] = useState(false);
  const { canPublishWorkbook } = useSubscription();

  // When the store's dataFolderPublishConfirmationOpen changes to true, show the folder selector
  useEffect(() => {
    if (dataFolderPublishConfirmationOpen && !showFolderSelector && !publishInProgress) {
      setShowFolderSelector(true);
      setInitialSelectedFolderIds(preselectedPublishDataFolderIds ?? undefined);
      closeDataFolderPublishConfirmation(); // Close the store's flag immediately
    }
  }, [
    dataFolderPublishConfirmationOpen,
    showFolderSelector,
    publishInProgress,
    preselectedPublishDataFolderIds,
    closeDataFolderPublishConfirmation,
  ]);

  const handleFoldersSelected = (folderIds: DataFolderId[]) => {
    setShowFolderSelector(false);
    // Start publishing each folder
    handleConfirmPublish(folderIds);
  };

  const handleFolderSelectorClose = () => {
    setShowFolderSelector(false);
    setInitialSelectedFolderIds(undefined);
  };

  const handleConfirmPublish = useCallback(
    async (folderIds: DataFolderId[]) => {
      setLimitExceeded(false);
      if (!workbook) return;
      if (!canPublishWorkbook) {
        setLimitExceeded(true);
        return;
      }
      try {
        // Publish all folders in a single job for unified progress tracking
        const result = await dataFolderApi.publish(folderIds, workbook.id);
        setPublishInProgress({ jobId: result.jobId });

        if (folderIds.length > 1) {
          ScratchpadNotifications.info({
            title: 'Publishing started',
            message: `Started publishing ${folderIds.length} data folders`,
            autoClose: 3000,
          });
        }
      } catch (e) {
        console.debug(e);
        ScratchpadNotifications.error({
          title: 'Publish failed',
          message: (e as Error).message ?? 'There was an error publishing your data',
          autoClose: 5000,
        });
      }
    },
    [workbook, canPublishWorkbook],
  );

  const handlePublishComplete = useCallback(async () => {
    setPublishInProgress(null);
    setInitialSelectedFolderIds(undefined);
    // Ensure the workbook is refreshed to reflect the changes to sync status
    await refreshWorkbook();
  }, [refreshWorkbook]);

  return (
    <>
      {workbook && showFolderSelector && (
        <DataFolderSelectorModal
          isOpen={showFolderSelector}
          onClose={handleFolderSelectorClose}
          onConfirm={handleFoldersSelected}
          initialSelectedFolderIds={initialSelectedFolderIds}
          title="Select data folders to publish"
          workbookId={workbook.id}
        />
      )}
      {limitExceeded && (
        <PublishLimitExceededModal
          isOpen={limitExceeded}
          onClose={() => {
            setLimitExceeded(false);
          }}
          serviceName={undefined}
        />
      )}
      {publishInProgress && <PublishJobProgressModal jobId={publishInProgress.jobId} onClose={handlePublishComplete} />}
    </>
  );
};
