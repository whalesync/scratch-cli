import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useConnectorAccount } from '@/hooks/use-connector-account';
import { snapshotApi } from '@/lib/api/snapshot';
import { DownloadSnapshotResult } from '@/types/server-entities/snapshot';
import { sleep } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import {
  ActionIcon,
  CheckIcon,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Text,
  TextInput,
  useModalsStack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  ChatIcon,
  DotsThreeVerticalIcon,
  DownloadSimpleIcon,
  PencilSimpleLineIcon,
  TrashIcon,
  UploadIcon,
} from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import pluralize from 'pluralize';
import { useState } from 'react';
import { useSnapshotContext } from './contexts/SnapshotContext';

export const SnapshotActionsMenu = ({
  aiChatOpen,
  onChatToggle,
}: {
  aiChatOpen: boolean;
  onChatToggle: () => void;
}) => {
  const router = useRouter();
  const { snapshot, isLoading, publish, updateSnapshot } = useSnapshotContext();
  const { connectorAccount } = useConnectorAccount(snapshot?.connectorAccountId);
  const modalStack = useModalsStack(['confirm-delete', 'download', 'publish', 'rename']);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [downloadResult, setDownloadResult] = useState<DownloadSnapshotResult | null>(null);
  const [snapshotName, setSnapshotName] = useState(snapshot?.name ?? '');
  const [saving, setSaving] = useState(false);

  const handleRename = async () => {
    if (!snapshot) return;
    try {
      setSaving(true);
      await updateSnapshot({ name: snapshotName });
      ScratchpadNotifications.success({
        message: 'The scratchpaper was renamed.',
      });
      modalStack.close('rename');
    } catch (e) {
      console.log(e);
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
      modalStack.open('download');
      const result = await snapshotApi.download(snapshot.id);
      setDownloadResult(result); // for future UI use
      // short sleep to avoid flicker in the modal for ultra fast downloads
      await sleep(500);

      ScratchpadNotifications.success({
        title: 'Download completed',
        message: `${result.totalRecords} ${pluralize('record', result.totalRecords)} have been downloaded from ${connectorAccount?.displayName}.`,
      });
    } catch (e) {
      console.log(e);
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
      console.log(e);
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

  return (
    <>
      <Modal {...modalStack.register('confirm-delete')} title="Abandon scratchpaper" centered size="lg">
        <Stack>
          <Text>Are you sure you want to abandon this scratchpaper? All data will be deleted.</Text>
          <Group justify="flex-end">
            <SecondaryButton onClick={() => modalStack.close('confirm-delete')}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleAbandon} loading={saving}>
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
      <Modal {...modalStack.register('publish')} title="Publishing scratchpaper" centered size="md">
        <Group gap="xs" wrap="nowrap">
          <Loader size="xs" />
          <Text>Your data is being published to {connectorAccount?.displayName}. This may take a few minutes.</Text>
        </Group>
      </Modal>
      <Modal {...modalStack.register('rename')} title="Rename scratchpaper" centered size="lg">
        <Stack>
          <TextInput label="Name" value={snapshotName} onChange={(e) => setSnapshotName(e.target.value)} />
          <Group justify="flex-end">
            <SecondaryButton onClick={() => modalStack.close('rename')}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleRename} loading={saving}>
              Save
            </PrimaryButton>
          </Group>
        </Stack>
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
          <Menu.Item
            disabled={menuItemsDisabled}
            onClick={() => modalStack.open('rename')}
            leftSection={<PencilSimpleLineIcon />}
          >
            Rename
          </Menu.Item>
          <Menu.Item disabled={menuItemsDisabled} onClick={handleDownload} leftSection={<DownloadSimpleIcon />}>
            Download
          </Menu.Item>
          <Menu.Item onClick={handlePublish} leftSection={<UploadIcon />}>
            Publish
          </Menu.Item>
          <Menu.Item
            color="red"
            disabled={menuItemsDisabled}
            leftSection={saving ? <Loader size="xs" /> : <TrashIcon />}
            onClick={() => modalStack.open('confirm-delete')}
          >
            Abandon
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
};
