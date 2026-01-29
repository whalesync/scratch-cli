import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ModalWrapper } from '@/app/components/ModalWrapper';
import { SelectTableRow } from '@/app/components/SelectTableRow';
import { Alert, Box, Text as MantineText, Stack } from '@mantine/core';
import { SnapshotTable, Workbook } from '@spinner/shared-types';
import { AlertCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DownloadProgressModal } from '@/app/components/jobs/download/DownloadJobProgressModal';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { TableSelection } from '@/app/components/TableSelectionComponent';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { workbookApi } from '@/lib/api/workbook';
import { useWorkbookEditorUIStore, WorkbookModals } from '@/stores/workbook-editor-store';
import { DownloadWorkbookResult, hasDeletedConnection } from '@/types/server-entities/workbook';

export const RefreshTableDataModal = () => {
  const activeModal = useWorkbookEditorUIStore((state) => state.activeModal);
  const dismissModal = useWorkbookEditorUIStore((state) => state.dismissModal);
  const isOpen = activeModal?.type === WorkbookModals.CONFIRM_REFRESH_SOURCE;

  const { workbook, activeTable } = useActiveWorkbook();
  const [refreshInProgress, setRefreshInProgress] = useState<DownloadWorkbookResult | null>(null);

  const startRefresh = async (tableSelection: TableSelection) => {
    if (!workbook) return;
    try {
      // Use downloadFiles API when in files mode, download API otherwise
      const result = await workbookApi.downloadFiles(workbook.id, tableSelection.tableIds);

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
      {workbook && (
        <ConfirmRefreshModal
          isOpen={isOpen}
          onClose={() => dismissModal(WorkbookModals.CONFIRM_REFRESH_SOURCE)}
          onConfirm={startRefresh}
          workbook={workbook}
          activeTable={(activeTable as SnapshotTable) ?? null}
          isFilesMode={true}
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
  isFilesMode = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tableSelection: TableSelection) => void;
  workbook: Workbook;
  activeTable: SnapshotTable | null;
  isFilesMode: boolean;
}) => {
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>(activeTable ? [activeTable.id] : []);

  // Filter tables based on mode
  // In files mode: only show tables with folderId (linked to a folder/remote service)
  // In tables mode: show all non-hidden tables without deleted connections
  const availableTables = useMemo(
    () =>
      workbook.snapshotTables?.filter((table: SnapshotTable) => {
        if (hasDeletedConnection(table) || table.hidden) {
          return false;
        }
        if (isFilesMode) {
          return !!table.connectorAccountId; // Only tables with folders in files mode
        }
        return true;
      }) || [],
    [workbook.snapshotTables, isFilesMode],
  );

  // Initialize selection on open
  useEffect(() => {
    if (isOpen) {
      if (activeTable && availableTables.some((t) => t.id === activeTable.id)) {
        setSelectedTableIds([activeTable.id]);
      } else if (availableTables.length > 0) {
        // Select all available tables/folders by default
        setSelectedTableIds(availableTables.map((t) => t.id));
      }
    }
  }, [isOpen, activeTable, availableTables]);

  const toggleTable = (tableId: string) => {
    setSelectedTableIds((prev) => (prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId]));
  };

  const handleConfirm = () => {
    onConfirm({
      mode: 'multiple',
      tableIds: selectedTableIds,
    });
  };

  const hasDirtyTables = availableTables.some(
    (table: SnapshotTable) => selectedTableIds.includes(table.id) && table.dirty,
  );

  const title = isFilesMode ? 'Select folders to refresh' : 'Select tables to refresh';
  const itemLabel = isFilesMode ? 'folders' : 'tables';

  return (
    <ModalWrapper
      customProps={{
        footer: (
          <>
            <ButtonSecondaryOutline onClick={onClose}>Cancel</ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleConfirm} disabled={selectedTableIds.length === 0}>
              Refresh data
            </ButtonPrimaryLight>
          </>
        ),
      }}
      opened={isOpen}
      onClose={onClose}
      title={title}
    >
      <Stack gap="md">
        {availableTables.length === 0 ? (
          <MantineText size="sm" c="dimmed">
            No {itemLabel} with remote connections available to refresh.
          </MantineText>
        ) : (
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
                  displayName={isFilesMode ? table.folder?.name : undefined}
                />
              );
            })}
          </Stack>
        )}

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
