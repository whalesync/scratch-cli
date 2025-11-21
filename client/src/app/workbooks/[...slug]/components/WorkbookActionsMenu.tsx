import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { TableSelection, TableSelectionComponent } from '@/app/components/TableSelectionComponent';
import { useConnectorAccount } from '@/hooks/use-connector-account';
import { useDevTools } from '@/hooks/use-dev-tools';
import { useExportAsCsv } from '@/hooks/use-export-as-csv';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { workbookApi } from '@/lib/api/workbook';
import { getPullOperationName, getPushOperationName } from '@/service-naming-conventions';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import {
  DownloadWorkbookResult,
  DownloadWorkbookWithoutJobResult,
  getActiveRecordSqlFilterById,
} from '@/types/server-entities/workbook';
import { sleep } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import { Group, Loader, Menu, Modal, Stack, Text, TextInput, useModalsStack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { DownloadSimpleIcon, PencilSimpleLineIcon, TrashIcon, UploadIcon } from '@phosphor-icons/react';
import {
  ArrowUp,
  BetweenVerticalEndIcon,
  Bot,
  Command,
  EyeIcon,
  FileDownIcon,
  FileUpIcon,
  SearchCodeIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import pluralize from 'pluralize';
import { useEffect, useRef, useState } from 'react';
import { mutate } from 'swr';
import { useActiveWorkbook } from '../../../../hooks/use-active-workbook';
import { SWR_KEYS } from '../../../../lib/api/keys';
import { Service } from '../../../../types/server-entities/connector-accounts';
import { SnapshotTableId } from '../../../../types/server-entities/ids';
import { ActionIconThreeDots } from '../../../components/base/action-icons';
import { DownloadProgressModal } from '../../../components/jobs/download/DownloadJobProgressModal';
import { WebflowPublishSiteMenuItem } from './snapshot-grid/custom-actions/webflow/WebflowPublishSiteMenuItem';
import { CreateScratchColumnModal } from './snapshot-grid/modals/CreateScratchColumnModal';

enum Modals {
  DOWNLOAD_WITHOUT_JOB = 'download-without-job',
  DOWNLOAD = 'download',
  RENAME = 'rename',
  CONFIRM_DELETE = 'confirm-delete',
  CONFIRM_DOWNLOAD = 'confirm-download',
}

export const WorkbookActionsMenu = () => {
  const router = useRouter();
  const { user } = useScratchPadUser();
  const { workbook, activeTable, updateWorkbook, isLoading, showAllColumns } = useActiveWorkbook();
  const { connectorAccount } = useConnectorAccount(activeTable?.connectorAccountId ?? undefined);
  const { handleDownloadCsv } = useExportAsCsv();
  const { isDevToolsEnabled } = useDevTools();
  const modalStack = useModalsStack(Object.values(Modals));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [downloadResult, setDownloadResult] = useState<DownloadWorkbookWithoutJobResult | null>(null);
  const [workbookName, setWorkbookName] = useState(workbook?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [downloadInProgress, setDownloadInProgress] = useState<DownloadWorkbookResult | null>(null);
  const [downloadingCsv, setDownloadingCsv] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [tableSelection, setTableSelection] = useState<TableSelection>({
    mode: 'current',
    tableIds: activeTable ? [activeTable.id] : [],
  });
  const [createScratchColumnModal, { open: openCreateScratchColumnModal, close: closeCreateScratchColumnModal }] =
    useDisclosure(false);

  const openDevTools = useWorkbookEditorUIStore((state) => state.openDevTools);
  const openPublishConfirmation = useWorkbookEditorUIStore((state) => state.openPublishConfirmation);

  useEffect(() => {
    if (activeTable) {
      setTableSelection({
        mode: 'current',
        tableIds: [activeTable.id],
      });
    }
  }, [activeTable, setTableSelection]);

  const handleRename = async () => {
    if (!workbook) return;
    try {
      setSaving(true);
      await updateWorkbook({ name: workbookName });
      ScratchpadNotifications.success({
        message: 'The workbook was renamed.',
      });
      modalStack.close(Modals.RENAME);
    } catch {
      ScratchpadNotifications.error({
        title: 'Renaming failed',
        message: 'There was an error renaming the workbook to ' + workbookName,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!workbook) return;
    try {
      const result = await workbookApi.download(workbook.id, tableSelection.tableIds);
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

  const handleImportSuggestions = async (file: File | null, tableId: SnapshotTableId) => {
    if (!workbook || !file) {
      console.debug('handleImportSuggestions: early return', { workbook: !!workbook, file: !!file });
      return;
    }

    console.debug('handleImportSuggestions: starting', { workbookId: workbook.id, tableId, fileName: file.name });

    try {
      setUploadingFile(tableId);
      const result = await workbookApi.importSuggestions(workbook.id, tableId, file);
      await mutate(SWR_KEYS.operationCounts.get(workbook.id));
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
    if (!workbook) return;
    try {
      modalStack.open(Modals.DOWNLOAD_WITHOUT_JOB);

      const result = await workbookApi.downloadWithoutJob(workbook.id);
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
    if (!workbook) return;
    openPublishConfirmation();
  };

  const handleAbandon = async () => {
    if (!workbook) return;
    try {
      setSaving(true);
      await workbookApi.delete(workbook.id);
      ScratchpadNotifications.success({
        title: 'Workbook abandoned',
        message: 'The workbook and its data have been deleted.',
      });

      router.push(RouteUrls.workbooksPageUrl);
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
    if (!workbook) return;
    router.push(`/agent-input/${workbook.id}`);
  };

  const menuItemsDisabled = isLoading || saving;

  const hasActiveRecordSqlFilter = (tableId: string) => {
    if (!workbook) return false;
    if (!tableId) return false;
    const filter = getActiveRecordSqlFilterById(workbook, tableId);
    return filter && filter.trim() !== '';
  };

  const hasHiddenColumns = activeTable?.hiddenColumns && activeTable.hiddenColumns.length > 0;

  const renderConnectorCustomActions = () => {
    if (!workbook || !activeTable) return null;

    // Webflow-specific actions
    if (activeTable.connectorService === Service.WEBFLOW) {
      return (
        <>
          <Menu.Divider />
          <Menu.Label>Webflow</Menu.Label>
          <WebflowPublishSiteMenuItem
            currentTable={activeTable}
            disabled={menuItemsDisabled}
            onPublishStart={() => setSaving(true)}
            onPublishEnd={() => setSaving(false)}
          />
        </>
      );
    }

    return null;
  };

  const renderDevToolsMenuItems = () => {
    if (!isDevToolsEnabled) return null;

    return (
      <>
        <Menu.Divider />
        <Menu.Label>Dev Tools</Menu.Label>
        <Menu.Item onClick={openDevTools} leftSection={<SearchCodeIcon size={16} />}>
          Workbook Inpsector
        </Menu.Item>
      </>
    );
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

          {workbook && activeTable && (
            <TableSelectionComponent
              tables={workbook.snapshotTables || []}
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
      <Modal {...modalStack.register(Modals.RENAME)} title="Rename workbook" centered size="lg">
        <Stack>
          <TextInput label="Name" value={workbookName} onChange={(e) => setWorkbookName(e.target.value)} />
          <Group justify="flex-end">
            <ButtonSecondaryOutline onClick={() => modalStack.close(Modals.RENAME)}>Cancel</ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleRename} loading={saving}>
              Save
            </ButtonPrimaryLight>
          </Group>
        </Stack>
      </Modal>
      <Menu>
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
            // disabled={workbook?.connectorService === null}
          >
            {getPushOperationName(connectorAccount?.service)}
          </Menu.Item>

          {workbook && activeTable && (
            <>
              <Menu.Divider />
              <Menu.Label>CSV</Menu.Label>

              <Menu.Item
                disabled={menuItemsDisabled || downloadingCsv === activeTable.id}
                onClick={() => {
                  handleDownloadCsv(workbook, activeTable.id, activeTable.tableSpec.name, setDownloadingCsv, false);
                }}
                leftSection={downloadingCsv === activeTable.id ? <Loader size="xs" /> : <FileDownIcon size={16} />}
              >
                Export all {activeTable.tableSpec.name} as CSV
              </Menu.Item>

              <Menu.Item
                disabled={
                  menuItemsDisabled || downloadingCsv === activeTable.id || !hasActiveRecordSqlFilter(activeTable.id)
                }
                onClick={() => {
                  handleDownloadCsv(
                    workbook,
                    activeTable.id,
                    activeTable.tableSpec.name + ' (filtered)',
                    setDownloadingCsv,
                    true,
                  );
                }}
                leftSection={downloadingCsv === activeTable.id ? <Loader size="xs" /> : <FileDownIcon size={16} />}
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
                    handleImportSuggestions(file, activeTable?.id);
                    e.target.value = ''; // Reset input
                  }
                }}
              />
              <Menu.Item onClick={openCreateScratchColumnModal} leftSection={<BetweenVerticalEndIcon size={16} />}>
                Add Scratch Column
              </Menu.Item>

              {hasHiddenColumns && (
                <Menu.Item onClick={() => showAllColumns(activeTable.id)} leftSection={<EyeIcon size={16} />}>
                  Show all hidden columns
                </Menu.Item>
              )}
            </>
          )}

          {/* Connector-custom actions */}
          {renderConnectorCustomActions()}

          {renderDevToolsMenuItems()}

          <Menu.Divider />
          <Menu.Item
            data-delete
            disabled={menuItemsDisabled}
            leftSection={saving ? <Loader size="xs" /> : <TrashIcon />}
            onClick={() => modalStack.open(Modals.CONFIRM_DELETE)}
          >
            Abandon
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {/* Fully remove the modal when not shown, to clean up state */}
      {downloadInProgress && workbook?.id && (
        <DownloadProgressModal jobId={downloadInProgress.jobId} onClose={() => setDownloadInProgress(null)} />
      )}
      {workbook && activeTable && activeTable.id && (
        <CreateScratchColumnModal
          opened={createScratchColumnModal}
          onClose={closeCreateScratchColumnModal}
          workbookId={workbook.id}
          tableId={activeTable.id}
        />
      )}
    </>
  );
};
