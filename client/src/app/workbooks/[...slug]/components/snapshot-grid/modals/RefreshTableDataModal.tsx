import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ModalWrapper } from '@/app/components/ModalWrapper';
import { SelectTableRow } from '@/app/components/SelectTableRow';
import { Alert, Box, Text as MantineText, Stack } from '@mantine/core';
import { AlertCircle } from 'lucide-react';
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
import { DownloadProgressModal } from '../../../../../components/jobs/download/DownloadJobProgressModal';
import { ScratchpadNotifications } from '../../../../../components/ScratchpadNotifications';
import { TableSelection } from '../../../../../components/TableSelectionComponent';

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
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([activeTable.id]);

  // Initialize selection on open
  useEffect(() => {
    if (isOpen && activeTable) {
      setSelectedTableIds([activeTable.id]);
    }
  }, [isOpen, activeTable]);

  const toggleTable = (tableId: string) => {
    setSelectedTableIds((prev) => (prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId]));
  };

  const handleConfirm = () => {
    onConfirm({
      mode: 'multiple',
      tableIds: selectedTableIds,
    });
  };

  const availableTables = workbook.snapshotTables?.filter((table) => !hasDeletedConnection(table)) || [];

  const hasDirtyTables = availableTables.some((table) => selectedTableIds.includes(table.id) && table.dirty);

  return (
    <ModalWrapper
      customProps={{
        footer: (
          <>
            <ButtonSecondaryOutline onClick={onClose}>Cancel</ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleConfirm} disabled={selectedTableIds.length === 0}>
              Download
            </ButtonPrimaryLight>
          </>
        ),
      }}
      opened={isOpen}
      onClose={onClose}
      title="Select tables to fetch"
    >
      <Stack gap="md">
        <Stack gap="xs">
          {availableTables.map((table) => {
            const isSyncing = !!table.lock;
            const isDirty = table.dirty;
            const statusText = (
              <MantineText size="sm" c={isDirty ? 'orange' : 'dimmed'}>
                {isDirty ? 'Contains unpublished changes' : ''}
              </MantineText>
            );

            return (
              <SelectTableRow
                key={table.id}
                table={table}
                isSelected={selectedTableIds.includes(table.id)}
                disabled={isSyncing}
                onToggle={toggleTable}
                statusText={statusText}
              />
            );
          })}
        </Stack>

        <Box mih={40}>
          {hasDirtyTables && (
            <Alert icon={<StyledLucideIcon Icon={AlertCircle} size={16} />} color="yellow" p="xs">
              Fields with unpublished changes will not be updated.
            </Alert>
          )}
        </Box>
      </Stack>
    </ModalWrapper>
  );
};
