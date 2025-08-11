import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useConnectorAccount } from '@/hooks/use-connector-account';
import { snapshotApi } from '@/lib/api/snapshot';
import { RouteUrls } from '@/utils/route-urls';
import { ActionIcon, CheckIcon, Loader, Menu } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ChatIcon, DotsThreeVerticalIcon, DownloadSimpleIcon, TrashIcon, UploadIcon } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
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
  const [downloading, setDownloading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      setDownloading(true);
      await snapshotApi.download(snapshot.id);
      ScratchpadNotifications.info({
        title: 'Download started',
        message: 'Your data is being downloaded from the remote source.',
      });
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Download failed',
        message: 'There was an error starting the download.',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handlePublish = async () => {
    if (!snapshot) return;
    try {
      setPublishing(true);
      notifications.show({
        id: 'publish-notification', // So it gets replaced by below.
        title: 'Publishing',
        message: `Your data is being published to ${connectorAccount?.service}`,
        color: 'blue',
        loading: true,
        autoClose: false,
        withCloseButton: false,
      });
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
      setPublishing(false);
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

  const menuItemsDisabled = isLoading || downloading || publishing || deleting;

  return (
    <Menu shadow="md" width={200}>
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
        <Menu.Item
          disabled={menuItemsDisabled}
          onClick={handleDownload}
          leftSection={downloading ? <Loader size="xs" /> : <DownloadSimpleIcon />}
        >
          Download
        </Menu.Item>
        <Menu.Item
          disabled={menuItemsDisabled}
          onClick={handlePublish}
          leftSection={publishing ? <Loader size="xs" /> : <UploadIcon />}
        >
          Publish
        </Menu.Item>
        <Menu.Item
          color="red"
          disabled={menuItemsDisabled}
          leftSection={deleting ? <Loader size="xs" /> : <TrashIcon />}
          onClick={handleAbandon}
        >
          Abandon
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
