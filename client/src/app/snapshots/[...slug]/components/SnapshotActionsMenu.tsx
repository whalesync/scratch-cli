import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useConnectorAccount } from '@/hooks/use-connector-account';
import { useExportAsCsv } from '@/hooks/use-export-as-csv';
import { snapshotApi } from '@/lib/api/snapshot';
import { getPullOperationName, getPushOperationName, serviceName } from '@/service-naming-conventions';
import { DownloadSnapshotResult, DownloadSnapshotWithouotJobResult } from '@/types/server-entities/snapshot';
import { sleep } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import { ActionIcon, Group, Loader, Menu, Modal, Stack, Text, TextInput, useModalsStack } from '@mantine/core';
import {
  DotsThreeVerticalIcon,
  DownloadSimpleIcon,
  PencilSimpleLineIcon,
  TrashIcon,
  UploadIcon,
} from '@phosphor-icons/react';
import { Download, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import pluralize from 'pluralize';
import React, { useRef, useState } from 'react';
import { DownloadProgressModal } from '../../../components/jobs/download/DownloadJobProgressModal';
import { useSnapshotContext } from './contexts/SnapshotContext';
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
  const { snapshot, isLoading, publish, updateSnapshot } = useSnapshotContext();
  const { connectorAccount } = useConnectorAccount(snapshot?.connectorAccountId ?? undefined);
  const { handleDownloadCsv } = useExportAsCsv();
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

  const handleRename = async () => {
    if (!snapshot) return;
    try {
      setSaving(true);
      await updateSnapshot({ name: snapshotName });
      ScratchpadNotifications.success({
        message: 'The scratchpaper was renamed.',
      });
      modalStack.close(Modals.RENAME);
    } catch {
      ScratchpadNotifications.error({
        title: 'Renaming failed',
        message: 'There was an error renaming the scratchpaper to ' + snapshotName,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!snapshot) return;
    try {
      const result = await snapshotApi.download(snapshot.id);
      setDownloadInProgress(result);
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
        message: 'The scratchpaper and its data have been deleted.',
      });

      router.push(RouteUrls.snapshotsPageUrl);
    } catch (e) {
      console.log(e);
      ScratchpadNotifications.error({
        title: 'Deletion failed',
        message: 'There was an error deleting the scratchpaper.',
      });
    } finally {
      setSaving(false);
    }
  };

  const menuItemsDisabled = isLoading || saving;

  const hasActiveRecordSqlFilter = (tableId: string) => {
    return snapshot?.activeRecordSqlFilter?.[tableId] && snapshot.activeRecordSqlFilter[tableId].trim() !== '';
  };

  return (
    <>
      <Modal {...modalStack.register(Modals.CONFIRM_DELETE)} title="Abandon scratchpaper" centered size="lg">
        <Stack>
          <Text>Are you sure you want to abandon this scratchpaper? All data will be deleted.</Text>
          <Group justify="flex-end">
            <SecondaryButton onClick={() => modalStack.close(Modals.CONFIRM_DELETE)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleAbandon} loading={saving}>
              Delete
            </PrimaryButton>
          </Group>
        </Stack>
      </Modal>
      <Modal {...modalStack.register(Modals.CONFIRM_DOWNLOAD)} title="Downloading records" centered size="lg">
        <Stack>
          <Text>
            Are you sure you want to download records for this scratchpaper? Any unpublished changes and suggestions
            will be lost.
          </Text>
          <Group justify="flex-end">
            <SecondaryButton onClick={() => modalStack.close(Modals.CONFIRM_DOWNLOAD)}>Cancel</SecondaryButton>
            <PrimaryButton
              onClick={() => {
                modalStack.close(Modals.CONFIRM_DOWNLOAD);
                if (process.env.NEXT_PUBLIC_USE_JOBS === 'true') {
                  handleDownload();
                } else {
                  handleDownloadWithoutJob();
                }
              }}
            >
              Continue
            </PrimaryButton>
          </Group>
        </Stack>
      </Modal>
      <Modal {...modalStack.register(Modals.DOWNLOAD_WITHOUT_JOB)} title="Downloading records" centered size="md">
        <Group gap="xs" wrap="nowrap">
          <Loader size="xs" />
          <Text>Your data is being downloaded from the remote source. This may take a few minutes.</Text>
        </Group>
      </Modal>
      <Modal {...modalStack.register(Modals.PUBLISH)} title="Publishing scratchpaper" centered size="md">
        <Group gap="xs" wrap="nowrap">
          <Loader size="xs" />
          <Text>Your data is being published to {connectorAccount?.displayName}. This may take a few minutes.</Text>
        </Group>
      </Modal>
      <Modal {...modalStack.register(Modals.RENAME)} title="Rename scratchpaper" centered size="lg">
        <Stack>
          <TextInput label="Name" value={snapshotName} onChange={(e) => setSnapshotName(e.target.value)} />
          <Group justify="flex-end">
            <SecondaryButton onClick={() => modalStack.close(Modals.RENAME)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleRename} loading={saving}>
              Save
            </PrimaryButton>
          </Group>
        </Stack>
      </Modal>
      <Menu shadow="md" width={250}>
        <Menu.Target>
          <ActionIcon variant="transparent-hover" size="md" color="gray">
            <StyledLucideIcon Icon={DotsThreeVerticalIcon} size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            disabled={menuItemsDisabled}
            onClick={() => modalStack.open(Modals.RENAME)}
            leftSection={<PencilSimpleLineIcon />}
          >
            Rename
          </Menu.Item>

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
            // disabled={snapshot?.connectorService === null}
          >
            {getPushOperationName(connectorAccount?.service)}
          </Menu.Item>

          <Menu.Divider />
          <Menu.Label>CSV</Menu.Label>
          {snapshot?.tables && snapshot.tables.length > 0 && (
            <>
              {snapshot.tables.map((table) => (
                <React.Fragment key={table.id.wsId}>
                  <Menu.Item
                    disabled={menuItemsDisabled || downloadingCsv === table.id.wsId}
                    onClick={() => {
                      handleDownloadCsv(snapshot, table.id.wsId, table.name, setDownloadingCsv, false);
                    }}
                    leftSection={downloadingCsv === table.id.wsId ? <Loader size="xs" /> : <Download size={16} />}
                  >
                    Export All as CSV
                  </Menu.Item>

                  <Menu.Item
                    disabled={
                      menuItemsDisabled || downloadingCsv === table.id.wsId || !hasActiveRecordSqlFilter(table.id.wsId)
                    }
                    onClick={() => {
                      handleDownloadCsv(snapshot, table.id.wsId, table.name + ' (filtered)', setDownloadingCsv, true);
                    }}
                    leftSection={downloadingCsv === table.id.wsId ? <Loader size="xs" /> : <Download size={16} />}
                  >
                    Export Filtered as CSV
                  </Menu.Item>

                  <Menu.Item
                    disabled={menuItemsDisabled || uploadingFile === table.id.wsId}
                    onClick={(e) => {
                      e.preventDefault();
                      console.debug('Menu.Item clicked for table:', table.id.wsId);
                      const input = fileInputRefs.current[table.id.wsId];
                      if (input) {
                        console.debug('Triggering file input click');
                        input.click();
                      } else {
                        console.debug('File input ref not found for table:', table.id.wsId);
                      }
                    }}
                    leftSection={uploadingFile === table.id.wsId ? <Loader size="xs" /> : <Upload size={16} />}
                    closeMenuOnClick={false}
                  >
                    Import Suggestions
                  </Menu.Item>
                  <input
                    key={`file-input-${table.id.wsId}`}
                    type="file"
                    ref={(el) => {
                      fileInputRefs.current[table.id.wsId] = el;
                    }}
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      console.debug('File input onChange triggered', { files: e.target.files?.length });
                      const file = e.target.files?.[0];
                      if (file) {
                        console.debug('File selected:', file.name);
                        handleImportSuggestions(file, table.id.wsId);
                        e.target.value = ''; // Reset input
                      }
                    }}
                  />
                </React.Fragment>
              ))}
            </>
          )}
          <Menu.Divider />

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
          serviceName={serviceName(snapshot.connectorService)}
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
    </>
  );
};
