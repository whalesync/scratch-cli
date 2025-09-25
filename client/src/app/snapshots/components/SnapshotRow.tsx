import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useSnapshots } from '@/hooks/use-snapshot';
import { tableName, tablesName } from '@/service-naming-conventions';
import { Service } from '@/types/server-entities/connector-accounts';
import { Snapshot } from '@/types/server-entities/snapshot';
import { formatDate } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import { ActionIcon, Group, Menu, Modal, Stack, Table, Text, TextInput, useModalsStack } from '@mantine/core';
import { DotsThreeVerticalIcon, PencilSimpleLineIcon, TrashIcon } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConnectorIcon } from '../../components/ConnectorIcon';
import { StyledIcon } from '../../components/Icons/StyledIcon';

export const SnapshotRow = ({ snapshot }: { snapshot: Snapshot }) => {
  const router = useRouter();
  const { deleteSnapshot, updateSnapshot } = useSnapshots();
  const [saving, setSaving] = useState(false);
  const [snapshotName, setSnapshotName] = useState(snapshot.name ?? undefined);
  const modalStack = useModalsStack(['confirm-delete', 'rename']);

  const handleAbandon = async () => {
    if (!snapshot) return;
    try {
      setSaving(true);
      await deleteSnapshot(snapshot.id);
      ScratchpadNotifications.success({
        title: 'Scratchpaper abandoned',
        message: 'The scratchpaper and its data have been deleted.',
      });
      modalStack.close('confirm-delete');
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Deletion failed',
        message: 'There was an error deleting the scratchpaper.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async () => {
    if (!snapshot) return;
    try {
      setSaving(true);
      await updateSnapshot(snapshot.id, { name: snapshotName });
      ScratchpadNotifications.success({
        message: 'The scratchpaper has been renamed.',
      });
      modalStack.close('rename');
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Renaming failed',
        message: 'There was an error renaming the scratchpaper.',
      });
    } finally {
      setSaving(false);
    }
  };

  const menuItems = [
    <Menu.Item
      key="rename"
      leftSection={<PencilSimpleLineIcon />}
      onClick={(e) => {
        e.stopPropagation();
        modalStack.open('rename');
      }}
    >
      Rename
    </Menu.Item>,
    <Menu.Item
      key="delete"
      leftSection={<TrashIcon />}
      color="red"
      onClick={(e) => {
        e.stopPropagation();
        modalStack.open('confirm-delete');
      }}
    >
      Abandon
    </Menu.Item>,
  ];

  const menu = (
    <Menu shadow="md" width={240}>
      <Menu.Target>
        <ActionIcon
          size="lg"
          variant="subtle"
          color="gray"
          onClick={(e) => e.stopPropagation()}
          component="div"
          style={{
            transition: 'opacity 0.2s ease',
            visibility: 'visible',
          }}
        >
          <StyledIcon Icon={DotsThreeVerticalIcon} c="gray" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>{menuItems}</Menu.Dropdown>
    </Menu>
  );

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
      <Table.Tr
        key={snapshot.id}
        onClick={() => router.push(RouteUrls.snapshotPage(snapshot.id))}
        style={{ cursor: 'pointer' }}
      >
        <Table.Td>
          <Group gap="sm" wrap="nowrap">
            <ConnectorIcon size={24} connector={snapshot.connectorService} />
            {snapshot.name}
          </Group>
        </Table.Td>
        <Table.Td>
          <Text fz="sm" c="dimmed">
            {snapshot.tables.length}{' '}
            {snapshot.tables.length === 1
              ? tableName(snapshot.connectorService as Service)
              : tablesName(snapshot.connectorService as Service)}
          </Text>
        </Table.Td>
        <Table.Td>{formatDate(snapshot.createdAt)}</Table.Td>
        <Table.Td>
          <Group gap="xs" justify="flex-end">
            {menu}
          </Group>
        </Table.Td>
      </Table.Tr>
    </>
  );
};
