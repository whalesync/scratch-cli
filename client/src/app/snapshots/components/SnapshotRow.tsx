import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { TextTitleSm } from '@/app/components/base/text';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useSnapshots } from '@/hooks/use-snapshot';
import { tableName, tablesName } from '@/service-naming-conventions';
import { Service } from '@/types/server-entities/connector-accounts';
import { Snapshot } from '@/types/server-entities/snapshot';
import { formatDate } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import { Group, Modal, Stack, Table, Text, TextInput, useModalsStack } from '@mantine/core';
import { Edit3, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConnectorIcon } from '../../components/ConnectorIcon';

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
            <TextTitleSm>{snapshot.name}</TextTitleSm>
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
            <ToolIconButton
              size="md"
              onClick={(e) => {
                e.stopPropagation();
                modalStack.open('rename');
              }}
              icon={Edit3}
              tooltip="Rename scratchpaper"
            />
            <ToolIconButton
              size="md"
              onClick={(e) => {
                e.stopPropagation();
                modalStack.open('confirm-delete');
              }}
              icon={Trash2}
              tooltip="Abandon scratchpaper"
            />
          </Group>
        </Table.Td>
      </Table.Tr>
    </>
  );
};
