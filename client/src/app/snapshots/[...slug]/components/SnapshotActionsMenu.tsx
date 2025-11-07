import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { TableSelection, TableSelectionComponent } from '@/app/components/TableSelectionComponent';
import { useConnectorAccount } from '@/hooks/use-connector-account';
import { useDevTools } from '@/hooks/use-dev-tools';
import { useExportAsCsv } from '@/hooks/use-export-as-csv';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { snapshotApi } from '@/lib/api/snapshot';
import { getPullOperationName, getPushOperationName, serviceName } from '@/service-naming-conventions';
import {
  DownloadSnapshotResult,
  DownloadSnapshotWithouotJobResult,
  getActiveRecordSqlFilterByWsId,
} from '@/types/server-entities/snapshot';
import { sleep } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import { Group, Loader, Menu, Modal, Stack, Text, TextInput, useModalsStack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { DownloadSimpleIcon, PencilSimpleLineIcon, TrashIcon, UploadIcon } from '@phosphor-icons/react';
import { ArrowUp, BetweenVerticalEndIcon, Bot, Command, FileDownIcon, FileUpIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import pluralize from 'pluralize';
import { useRef, useState } from 'react';
import { useActiveSnapshot } from '../../../../hooks/use-active-snapshot';
import { ActionIconThreeDots } from '../../../components/base/action-icons';
import { DownloadProgressModal } from '../../../components/jobs/download/DownloadJobProgressModal';
import { CreateScratchColumnModal } from './snapshot-grid/modals/CreateScratchColumnModal';
import { PublishConfirmationModal } from './snapshot-grid/modals/PublishConfirmationModal';

enum Modals {
  DOWNLOAD_WITHOUT_JOB = 'download-without-job',
  DOWNLOAD = 'download',
  PUBLISH = 'publish',
  RENAME = 'rename',
  CONFIRM_DELETE = 'confirm-delete',
  CONFIRM_DOWNLOAD = 'confirm-download',
}

export const SnapshotActionsMenu = () => {
  const router = useRouter();
  const { user } = useScratchPadUser();
  const { snapshot, activeTable, updateSnapshot, publish, isLoading } = useActiveSnapshot();
  const { connectorAccount } = useConnectorAccount(activeTable?.connectorAccountId ?? undefined);
  const { handleDownloadCsv } = useExportAsCsv();
  const { isDevToolsEnabled } = useDevTools();
  const modalStack = useModalsStack(Object.values(Modals));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [downloadResult, setDownloadResult] = useState<DownloadSnapshotWithouotJobResult | null>(null);
  const [snapshotName, setSnapshotName] = useState(snapshot?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [showPublishConfirmation, setShowPublishConfirmation] = useState(false);
  const [downloadInProgress, setDownloadInProgress] = useState<DownloadSnapshotResult | null>(null);
  const [downloadingCsv, setDownloadingCsv] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [tableSelection, setTableSelection] = useState<TableSelection>({
    mode: 'current',
    tableIds: activeTable ? [activeTable.id] : [],
  });
  const [createScratchColumnModal, { open: openCreateScratchColumnModal, close: closeCreateScratchColumnModal }] =
    useDisclosure(false);

  const handleRename = async () => {
    if (!snapshot) return;
    try {
      setSaving(true);
      await updateSnapshot({ name: snapshotName });
      ScratchpadNotifications.success({
        message: 'The workbook was renamed.',
      });
      modalStack.close(Modals.RENAME);
    } catch {
      ScratchpadNotifications.error({
        title: 'Renaming failed',
        message: 'There was an error renaming the workbook to ' + snapshotName,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!snapshot) return;
    try {
      const result = await snapshotApi.download(snapshot.id, tableSelection.tableIds);
      setDownloadInProgress(result);
      modalStack.close(Modals.CONFIRM_DOWNLOAD);
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Download failed',
        message: 'There was an error starting the download.',
      });
    }
  };

  const handleImportSuggestions = async (file: File | null, tableId: string) => {
    if (!snapshot || !file) {
      console.debug('handleImportSuggestions: early return', { snapshot: !!snapshot, file: !!file });
      return;
    }

    console.debug('handleImportSuggestions: starting', { snapshotId: snapshot.id, tableId, fileName: file.name });

    try {
      setUploadingFile(tableId);
      const result = await snapshotApi.importSuggestions(snapshot.id, tableId, file);
      console.debug('handleImportSuggestions: success', result);
      ScratchpadNotifications.success({
        title: 'Import completed',
        message: `Processed ${result.recordsProcessed} records and created ${result.suggestionsCreated} suggestions.`,
      });
    } catch (error) {
      console.error('handleImportSuggestions: error', error);
      ScratchpadNotifications.error({
        title: 'Import failed',
        message: error instanceof Error ? error.message : 'There was an error importing the suggestions.',
      });
    } finally {
      setUploadingFile(null);
    }
  };

  const handleDownloadWithoutJob = async () => {
    if (!snapshot) return;
    try {
      modalStack.open(Modals.DOWNLOAD_WITHOUT_JOB);

      const result = await snapshotApi.downloadWithoutJob(snapshot.id);
      setDownloadResult(result); // for future UI use
      // short sleep to avoid flicker in the modal for ultra fast downloads
      await sleep(500);

      ScratchpadNotifications.success({
        title: 'Download completed',
        message: `${result.totalRecords} ${pluralize('record', result.totalRecords)} have been downloaded from ${connectorAccount?.displayName}.`,
      });
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Download failed',
        message: 'There was an error starting the download.',
      });
    } finally {
      modalStack.close(Modals.DOWNLOAD_WITHOUT_JOB);
    }
  };

  const handlePublish = () => {
    if (!snapshot) return;
    setShowPublishConfirmation(true);
  };

  const handleConfirmPublish = async () => {
    if (!snapshot) return;
    try {
      setSaving(true);
      setShowPublishConfirmation(false);
      modalStack.open(Modals.PUBLISH);
      await publish?.();

      ScratchpadNotifications.success({
        title: 'Published',
        message: `Your data has been published to ${connectorAccount?.service}`,
        autoClose: 5000,
      });
    } catch (e) {
      console.debug(e);
      ScratchpadNotifications.error({
        title: 'Publish failed',
        message: (e as Error).message ?? 'There was an error publishing your data',
        autoClose: 5000,
      });
    } finally {
      setSaving(false);
      modalStack.close(Modals.PUBLISH);
    }
  };

  const handleAbandon = async () => {
    if (!snapshot) return;
    try {
      setSaving(true);
      await snapshotApi.delete(snapshot.id);
      ScratchpadNotifications.success({
        title: 'Snapshot abandoned',
        message: 'The workbook and its data have been deleted.',
      });

      router.push(RouteUrls.snapshotsPageUrl);
    } catch (e) {
      console.log(e);
      ScratchpadNotifications.error({
        title: 'Deletion failed',
        message: 'There was an error deleting the workbook.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAdvancedInput = () => {
    if (!snapshot) return;
    router.push(`/agent-input/${snapshot.id}`);
  };

  const menuItemsDisabled = isLoading || saving;

  const hasActiveRecordSqlFilter = (tableId: string) => {
    if (!snapshot) return false;
    if (!tableId) return false;
    const filter = getActiveRecordSqlFilterByWsId(snapshot, tableId);
    return filter && filter.trim() !== '';
  };

  return (
    <>
      <Modal
        {...modalStack.register(Modals.CONFIRM_DELETE)}
        title={`Abandon ${activeTable?.tableSpec.name}`}
        centered
        size="lg"
      >
        <Stack>
          <Text>
            Are you sure you want to abandon the {activeTable?.tableSpec.name} table? All scratch data will be deleted.
          </Text>
          <Group justify="flex-end">
            <ButtonSecondaryOutline onClick={() => modalStack.close(Modals.CONFIRM_DELETE)}>
              Cancel
            </ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleAbandon} loading={saving}>
              Delete
            </ButtonPrimaryLight>
          </Group>
        </Stack>
      </Modal>
      <Modal {...modalStack.register(Modals.CONFIRM_DOWNLOAD)} title="Download records" centered size="lg">
        <Stack gap="md">
          <Text>Download records from the remote source. Any unpublished changes and suggestions will be lost.</Text>

          {snapshot && activeTable && (
            <TableSelectionComponent
              tables={snapshot.snapshotTables || []}
              currentTableId={activeTable.id}
              onChange={setTableSelection}
              initialSelection={tableSelection}
            />
          )}

          <Group justify="flex-end">
            <ButtonSecondaryOutline onClick={() => modalStack.close(Modals.CONFIRM_DOWNLOAD)}>
              Cancel
            </ButtonSecondaryOutline>
            <ButtonPrimaryLight
              onClick={() => {
                if (user?.experimentalFlags?.USE_JOBS ?? false) {
                  handleDownload();
                } else {
                  handleDownloadWithoutJob();
                }
              }}
              disabled={tableSelection.tableIds.length === 0}
            >
              Download
            </ButtonPrimaryLight>
          </Group>
        </Stack>
      </Modal>
      <Modal {...modalStack.register(Modals.DOWNLOAD_WITHOUT_JOB)} title="Downloading records" centered size="md">
        <Group gap="xs" wrap="nowrap">
          <Loader size="xs" />
          <Text>Your data is being downloaded from the remote source. This may take a few minutes.</Text>
        </Group>
      </Modal>
      <Modal {...modalStack.register(Modals.PUBLISH)} title="Publishing workbook" centered size="md">
        <Group gap="xs" wrap="nowrap">
          <Loader size="xs" />
          <Text>Your data is being published to {connectorAccount?.displayName}. This may take a few minutes.</Text>
        </Group>
      </Modal>
      <Modal {...modalStack.register(Modals.RENAME)} title="Rename workbook" centered size="lg">
        <Stack>
          <TextInput label="Name" value={snapshotName} onChange={(e) => setSnapshotName(e.target.value)} />
          <Group justify="flex-end">
            <ButtonSecondaryOutline onClick={() => modalStack.close(Modals.RENAME)}>Cancel</ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleRename} loading={saving}>
              Save
            </ButtonPrimaryLight>
          </Group>
        </Stack>
      </Modal>
      <Menu shadow="md" width={250}>
        <Menu.Target>
          <ActionIconThreeDots />
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            disabled={menuItemsDisabled}
            onClick={() => modalStack.open(Modals.RENAME)}
            leftSection={<PencilSimpleLineIcon />}
          >
            Rename
          </Menu.Item>

          {isDevToolsEnabled && (
            <Menu.Item disabled={menuItemsDisabled} onClick={handleOpenAdvancedInput} leftSection={<Bot size={16} />}>
              Advanced Agent Input
            </Menu.Item>
          )}

          <Menu.Divider />
          <Menu.Label>Sync with source</Menu.Label>
          <Menu.Item
            disabled={menuItemsDisabled}
            onClick={() => {
              modalStack.open(Modals.CONFIRM_DOWNLOAD);
            }}
            leftSection={<DownloadSimpleIcon />}
          >
            {getPullOperationName(connectorAccount?.service)}
          </Menu.Item>
          <Menu.Item
            onClick={handlePublish}
            leftSection={<UploadIcon />}
            rightSection={
              <Group gap="xs" align="center">
                <Text size="xs" c="dimmed">
                  /publish
                </Text>
                ,
                <Group gap={2} align="center">
                  <StyledLucideIcon Icon={Command} size={12} c="dimmed" />
                  <StyledLucideIcon Icon={ArrowUp} size={12} c="dimmed" strokeWidth={5} />
                  <Text size="xs" c="dimmed">
                    P
                  </Text>
                </Group>
              </Group>
            }
            // disabled={snapshot?.connectorService === null}
          >
            {getPushOperationName(connectorAccount?.service)}
          </Menu.Item>

          {snapshot && activeTable && (
            <>
              <Menu.Divider />
              <Menu.Label>CSV</Menu.Label>

              <Menu.Item
                disabled={menuItemsDisabled || downloadingCsv === activeTable.tableSpec.id.wsId}
                onClick={() => {
                  handleDownloadCsv(
                    snapshot,
                    activeTable.tableSpec.id.wsId,
                    activeTable.tableSpec.name,
                    setDownloadingCsv,
                    false,
                  );
                }}
                leftSection={
                  downloadingCsv === activeTable.tableSpec.id.wsId ? <Loader size="xs" /> : <FileDownIcon size={16} />
                }
              >
                Export all {activeTable.tableSpec.name} as CSV
              </Menu.Item>

              <Menu.Item
                disabled={
                  menuItemsDisabled ||
                  downloadingCsv === activeTable.tableSpec.id.wsId ||
                  !hasActiveRecordSqlFilter(activeTable.tableSpec.id.wsId)
                }
                onClick={() => {
                  handleDownloadCsv(
                    snapshot,
                    activeTable.tableSpec.id.wsId,
                    activeTable.tableSpec.name + ' (filtered)',
                    setDownloadingCsv,
                    true,
                  );
                }}
                leftSection={
                  downloadingCsv === activeTable.tableSpec.id.wsId ? <Loader size="xs" /> : <FileDownIcon size={16} />
                }
              >
                Export filtered {activeTable.tableSpec.name} as CSV
              </Menu.Item>
              <Menu.Item
                disabled={menuItemsDisabled || uploadingFile === activeTable?.id}
                onClick={(e) => {
                  e.preventDefault();
                  console.debug('Menu.Item clicked for table:', activeTable?.id);
                  const input = fileInputRefs.current[activeTable?.id];
                  if (input) {
                    console.debug('Triggering file input click');
                    input.click();
                  } else {
                    console.debug('File input ref not found for table:', activeTable?.id);
                  }
                }}
                leftSection={uploadingFile === activeTable?.id ? <Loader size="xs" /> : <FileUpIcon size={16} />}
                closeMenuOnClick={false}
              >
                Import Suggestions
              </Menu.Item>
              <input
                key={`file-input-${activeTable?.id}`}
                type="file"
                ref={(el) => {
                  fileInputRefs.current[activeTable?.id] = el;
                }}
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  console.debug('File input onChange triggered', { files: e.target.files?.length });
                  const file = e.target.files?.[0];
                  if (file) {
                    console.debug('File selected:', file.name);
                    handleImportSuggestions(file, activeTable?.tableSpec.id.wsId);
                    e.target.value = ''; // Reset input
                  }
                }}
              />
              <Menu.Item onClick={openCreateScratchColumnModal} leftSection={<BetweenVerticalEndIcon size={16} />}>
                Add Scratch Column
              </Menu.Item>
              <Menu.Divider />
            </>
          )}
          <Menu.Item
            color="red"
            disabled={menuItemsDisabled}
            leftSection={saving ? <Loader size="xs" /> : <TrashIcon />}
            onClick={() => modalStack.open(Modals.CONFIRM_DELETE)}
          >
            Abandon
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {/* Fully remove the modal when not shown, to clean up state */}
      {snapshot && (
        <PublishConfirmationModal
          isOpen={showPublishConfirmation}
          onClose={() => setShowPublishConfirmation(false)}
          onConfirm={handleConfirmPublish}
          snapshotId={snapshot?.id ?? ''}
          serviceName={activeTable?.connectorService ? serviceName(activeTable.connectorService) : undefined}
          isPublishing={saving}
        />
      )}

      {downloadInProgress && snapshot?.id && (
        <DownloadProgressModal
          snapshotId={snapshot.id}
          jobId={downloadInProgress.jobId}
          onClose={() => setDownloadInProgress(null)}
        />
      )}
      {snapshot && activeTable && activeTable.tableSpec.id.wsId && (
        <CreateScratchColumnModal
          opened={createScratchColumnModal}
          onClose={closeCreateScratchColumnModal}
          snapshotId={snapshot.id}
          tableId={activeTable.tableSpec.id.wsId}
        />
      )}
    </>
  );
};
