import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { TextMdHeavier } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useSnapshots } from '@/hooks/use-snapshots';
import { Snapshot } from '@/types/server-entities/snapshot';
import { RouteUrls } from '@/utils/route-urls';
import { Box, Group, Modal, Stack, Table, Text, TextInput, useModalsStack } from '@mantine/core';
import { Edit3, Table2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { StyledLucideIcon } from '../../components/Icons/StyledLucideIcon';
import { RelativeDate } from '../../components/RelativeDate';
import { ToolbarIconButton } from '../../components/ToolbarIconButton';

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
          <TextMdHeavier>
            <StyledLucideIcon Icon={Table2} size={13} centerInText c="gray.7" mr="xs" />
            {snapshot.name}
          </TextMdHeavier>
        </Table.Td>
        <Table.Td>
          {/* Icons are stacked on top of each other with an offset */}
          <Box pos="relative" h={21}>
            {(snapshot.snapshotTables || [])
              .filter((table) => !!table.connectorService)
              .map((table, index) => (
                <Box
                  key={table.id}
                  pos="absolute"
                  top={0}
                  left={index * 12}
                  bd="1px solid var(--mantine-color-body)"
                  bdrs="xs"
                >
                  <ConnectorIcon key={table.id} connector={table.connectorService} size={21} />
                </Box>
              ))}
          </Box>
        </Table.Td>
        <Table.Td>
          <RelativeDate date={snapshot.createdAt} />
        </Table.Td>
        <Table.Td>
          <Group gap="xs" justify="flex-end" onClick={(e) => e.stopPropagation()}>
            <ToolbarIconButton icon={Edit3} onClick={() => modalStack.open('rename')} title="Rename workbook" />
            <ToolbarIconButton
              icon={Trash2}
              onClick={() => modalStack.open('confirm-delete')}
              title="Delete workbook"
            />
          </Group>
        </Table.Td>
      </Table.Tr>
    </>
  );
};
