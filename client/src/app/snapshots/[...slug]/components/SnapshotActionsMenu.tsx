import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useConnectorAccount } from '@/hooks/use-connector-account';
import { snapshotApi } from '@/lib/api/snapshot';
import { DownloadSnapshotResult } from '@/types/server-entities/snapshot';
import { sleep } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import { ActionIcon, CheckIcon, Group, Loader, Menu, Modal, Stack, Text, useModalsStack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ChatIcon, DotsThreeVerticalIcon, DownloadSimpleIcon, TrashIcon, UploadIcon } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import pluralize from 'pluralize';
import { useState } from 'react';
import { useSnapshotContext } from '../SnapshotContext';

export const SnapshotActionsMenu = ({
  aiChatOpen,
  onChatToggle,
}: {
  aiChatOpen: boolean;
  onChatToggle: () => void;
}) => {
  const router = useRouter();
  const { snapshot, isLoading, publish } = useSnapshotContext();
  const { connectorAccount } = useConnectorAccount(snapshot?.connectorAccountId);
  const [deleting, setDeleting] = useState(false);
  const modalStack = useModalsStack(['confirm-delete', 'download', 'publish']);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [downloadResult, setDownloadResult] = useState<DownloadSnapshotResult | null>(null);

  const handleRename = async () => {
    if (!snapshot) return;
    try {
      //   await snapshotApi.update(snapshot.id, { name: 'New Name' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownload = async () => {
    if (!snapshot) return;
    try {
      modalStack.open('download');
      const result = await snapshotApi.download(snapshot.id);
      setDownloadResult(result); // for future UI use
      await sleep(1000);

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
      modalStack.close('download');
    }
  };

  const handlePublish = async () => {
    if (!snapshot) return;
    try {
      modalStack.open('publish');
      await publish?.();

      notifications.update({
        id: 'publish-notification',
        title: 'Published',
        message: `Your data has been published to ${connectorAccount?.service}`,
        color: 'green',
        icon: <CheckIcon size={18} />,
        loading: false,
        autoClose: 2000,
      });
    } catch (e) {
      console.error(e);
      notifications.update({
        id: 'publish-notification',
        title: 'Publish failed',
        message: (e as Error).message ?? 'There was an error publishing your data',
        color: 'red',
        loading: false,
        autoClose: 2000,
      });
    } finally {
      modalStack.close('publish');
    }
  };

  const handleAbandon = async () => {
    if (!snapshot) return;
    try {
      setDeleting(true);
      await snapshotApi.delete(snapshot.id);
      ScratchpadNotifications.success({
        title: 'Snapshot abandoned',
        message: 'The snapshot and its data have been deleted.',
      });

      router.push(RouteUrls.snapshotsPageUrl);
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Deletion failed',
        message: 'There was an error deleting the snapshot.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const menuItemsDisabled = isLoading || deleting;

  return (
    <>
      <Modal {...modalStack.register('confirm-delete')} title="Abandon snapshot" centered size="lg">
        <Stack>
          <Text>Are you sure you want to abandon this snapshot? All data will be deleted.</Text>
          <Group justify="flex-end">
            <SecondaryButton onClick={() => modalStack.close('confirm-delete')}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleAbandon} loading={deleting}>
              Delete
            </PrimaryButton>
          </Group>
        </Stack>
      </Modal>
      <Modal {...modalStack.register('download')} title="Downloading records" centered size="md">
        <Group gap="xs" wrap="nowrap">
          <Loader size="xs" />
          <Text>Your data is being downloaded from the remote source. This may take a few minutes.</Text>
        </Group>
      </Modal>
      <Modal {...modalStack.register('publish')} title="Publishing snapshot" centered size="md">
        <Group gap="xs" wrap="nowrap">
          <Loader size="xs" />
          <Text>Your data is being published to {connectorAccount?.displayName}. This may take a few minutes.</Text>
        </Group>
      </Modal>
      <Menu shadow="md" width={250}>
        <Menu.Target>
          <ActionIcon variant="transparent" size="md" color="gray.9">
            <DotsThreeVerticalIcon size={16} weight="bold" />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{snapshot?.name}</Menu.Label>
          <Menu.Divider />
          {aiChatOpen ? (
            <Menu.Item onClick={onChatToggle} leftSection={<ChatIcon />}>
              Close AI Chat
            </Menu.Item>
          ) : (
            <Menu.Item onClick={onChatToggle} leftSection={<ChatIcon />}>
              Open AI Chat
            </Menu.Item>
          )}
          <Menu.Item disabled onClick={handleRename} leftSection={<DownloadSimpleIcon />}>
            Rename Snapshot
          </Menu.Item>
          <Menu.Item disabled={menuItemsDisabled} onClick={handleDownload} leftSection={<DownloadSimpleIcon />}>
            Download
          </Menu.Item>
          <Menu.Item disabled={true} onClick={handlePublish} leftSection={<UploadIcon />}>
            Publish (Coming soon)
          </Menu.Item>
          <Menu.Item
            color="red"
            disabled={menuItemsDisabled}
            leftSection={deleting ? <Loader size="xs" /> : <TrashIcon />}
            onClick={() => modalStack.open('confirm-delete')}
          >
            Abandon
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
};
