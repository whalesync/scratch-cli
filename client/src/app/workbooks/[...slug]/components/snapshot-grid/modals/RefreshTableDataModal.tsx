import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { Group, Modal, Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useActiveWorkbook } from '../../../../../../hooks/use-active-workbook';
import { workbookApi } from '../../../../../../lib/api/workbook';
import { useWorkbookEditorUIStore, WorkbookModals } from '../../../../../../stores/workbook-editor-store';
import {
  DownloadWorkbookResult,
  hasDeletedConnection,
  SnapshotTable,
  Workbook,
} from '../../../../../../types/server-entities/workbook';
import { Text13Regular } from '../../../../../components/base/text';
import { DownloadProgressModal } from '../../../../../components/jobs/download/DownloadJobProgressModal';
import { ScratchpadNotifications } from '../../../../../components/ScratchpadNotifications';
import { TableSelection, TableSelectionComponent } from '../../../../../components/TableSelectionComponent';

export const RefreshTableDataModal = () => {
  const activeModal = useWorkbookEditorUIStore((state) => state.activeModal);
  const dismissModal = useWorkbookEditorUIStore((state) => state.dismissModal);
  const isOpen = activeModal?.type === WorkbookModals.CONFIRM_REFRESH_SOURCE;

  const { workbook, activeTable } = useActiveWorkbook();
  const [refreshInProgress, setRefreshInProgress] = useState<DownloadWorkbookResult | null>(null);

  const startRefresh = async (tableSelection: TableSelection) => {
    if (!workbook) return;
    try {
      const result = await workbookApi.download(workbook.id, tableSelection.tableIds);
      setRefreshInProgress(result);
      dismissModal(WorkbookModals.CONFIRM_REFRESH_SOURCE);
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Refresh failed',
        message: 'There was an error starting the refresh.',
      });
    }
  };

  return (
    <>
      {workbook && activeTable && (
        <ConfirmRefreshModal
          isOpen={isOpen}
          onClose={() => dismissModal(WorkbookModals.CONFIRM_REFRESH_SOURCE)}
          onConfirm={startRefresh}
          workbook={workbook}
          activeTable={activeTable}
        />
      )}

      {/* Only include a standard progress modal when the job is active */}
      {refreshInProgress && workbook?.id && (
        <DownloadProgressModal jobId={refreshInProgress.jobId} onClose={() => setRefreshInProgress(null)} />
      )}
    </>
  );
};

/** Ask the user to confirm that they want to refresh the table data */
const ConfirmRefreshModal = ({
  isOpen,
  onClose,
  onConfirm,
  workbook,
  activeTable,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tableSelection: TableSelection) => void;
  workbook: Workbook;
  activeTable: SnapshotTable;
}) => {
  const [tableSelection, setTableSelection] = useState<TableSelection>({
    mode: 'current',
    tableIds: activeTable ? [activeTable.id] : [],
  });

  // Iniitalize selection on open:
  useEffect(() => {
    if (isOpen) {
      setTableSelection({
        mode: 'current',
        tableIds: activeTable ? [activeTable.id] : [],
      });
    }
  }, [isOpen, activeTable]);

  return (
    <Modal opened={isOpen} onClose={onClose} title="Download records" centered size="lg">
      <Stack gap="md">
        <Text13Regular>
          Download records from the remote source. Any unpublished changes and suggestions will be lost.
        </Text13Regular>

        {workbook && activeTable && (
          <TableSelectionComponent
            tables={workbook.snapshotTables?.filter((table) => !hasDeletedConnection(table)) || []}
            currentTableId={activeTable.id}
            onChange={setTableSelection}
            initialSelection={tableSelection}
          />
        )}

        <Group justify="flex-end">
          <ButtonSecondaryOutline onClick={onClose}>Cancel</ButtonSecondaryOutline>
          <ButtonPrimaryLight onClick={() => onConfirm(tableSelection)} disabled={tableSelection.tableIds.length === 0}>
            Download
          </ButtonPrimaryLight>
        </Group>
      </Stack>
    </Modal>
  );
};
