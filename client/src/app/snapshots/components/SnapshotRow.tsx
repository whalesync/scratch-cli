import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { TextMdHeavier, TextSmRegular } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useSnapshots } from '@/hooks/use-snapshot';
import { Service } from '@/types/server-entities/connector-accounts';
import { Snapshot } from '@/types/server-entities/snapshot';
import { formatDate, timeAgo } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import { Group, Modal, Stack, Table, Text, TextInput, useModalsStack } from '@mantine/core';
import { Edit3, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export const SnapshotRow = ({ snapshot }: { snapshot: Snapshot }) => {
  const router = useRouter();
  const { deleteSnapshot, updateSnapshot } = useSnapshots();
  const [saving, setSaving] = useState(false);
  const [snapshotName, setSnapshotName] = useState(snapshot.name ?? undefined);
  const modalStack = useModalsStack(['confirm-delete', 'rename']);

  // Group tables by service and count them
  const serviceTableCounts = (snapshot.snapshotTables || []).reduce(
    (acc, table) => {
      if (table.connectorService) {
        acc[table.connectorService] = (acc[table.connectorService] || 0) + 1;
      }
      return acc;
    },
    {} as Record<Service, number>,
  );

  const handleAbandon = async () => {
    if (!snapshot) return;
    try {
      setSaving(true);
      await deleteSnapshot(snapshot.id);
      ScratchpadNotifications.success({
        title: 'Workbook abandoned',
        message: 'The workbook and its data have been deleted.',
      });
      modalStack.close('confirm-delete');
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Deletion failed',
        message: 'There was an error deleting the workbook.',
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
        message: 'The workbook has been renamed.',
      });
      modalStack.close('rename');
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Renaming failed',
        message: 'There was an error renaming the workbook.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal {...modalStack.register('confirm-delete')} title="Abandon workbook" centered size="lg">
        <Stack>
          <Text>Are you sure you want to abandon this workbook? All data will be deleted.</Text>
          <Group justify="flex-end">
            <ButtonSecondaryOutline onClick={() => modalStack.close('confirm-delete')}>Cancel</ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleAbandon} loading={saving}>
              Delete
            </ButtonPrimaryLight>
          </Group>
        </Stack>
      </Modal>
      <Modal {...modalStack.register('rename')} title="Rename workbook" centered size="lg">
        <Stack>
          <TextInput label="Name" value={snapshotName} onChange={(e) => setSnapshotName(e.target.value)} />
          <Group justify="flex-end">
            <ButtonSecondaryOutline onClick={() => modalStack.close('rename')}>Cancel</ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleRename} loading={saving}>
              Save
            </ButtonPrimaryLight>
          </Group>
        </Stack>
      </Modal>
      <Table.Tr
        key={snapshot.id}
        onClick={() => router.push(RouteUrls.snapshotPage(snapshot.id))}
        style={{ cursor: 'pointer' }}
      >
        <Table.Td>
          <TextMdHeavier>{snapshot.name}</TextMdHeavier>
        </Table.Td>
        <Table.Td>
          <Group gap="md" wrap="nowrap">
            {Object.entries(serviceTableCounts).map(([service, count]) => (
              <Group key={service} gap={4} wrap="nowrap">
                <ConnectorIcon connector={service as Service} size={24} />
                <TextSmRegular variant="dimmed">× {count}</TextSmRegular>
              </Group>
            ))}
          </Group>
        </Table.Td>
        <Table.Td>
          <Group gap="xs">
            <TextSmRegular>{formatDate(snapshot.createdAt)}</TextSmRegular>
            <TextSmRegular variant="dimmed">({timeAgo(snapshot.createdAt)})</TextSmRegular>
          </Group>
        </Table.Td>
        <Table.Td>
          <Group gap="xs" justify="flex-end">
            <ToolIconButton
              size="md"
              onClick={(e) => {
                e.stopPropagation();
                modalStack.open('rename');
              }}
              icon={Edit3}
              tooltip="Rename workbook"
            />
            <ToolIconButton
              size="md"
              onClick={(e) => {
                e.stopPropagation();
                modalStack.open('confirm-delete');
              }}
              icon={Trash2}
              tooltip="Abandon workbook"
            />
          </Group>
        </Table.Td>
      </Table.Tr>
    </>
  );
};
