import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useSnapshots } from '@/hooks/use-snapshot';
import { Snapshot } from '@/types/server-entities/snapshot';
import { RouteUrls } from '@/utils/route-urls';
import { ActionIcon, Card, Grid, Group, Menu, Modal, Stack, Text, TextInput, useModalsStack } from '@mantine/core';
import { DotsThreeVerticalIcon, PencilSimpleLineIcon, TrashIcon } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import pluralize from 'pluralize';
import { useState } from 'react';
import { ConnectorIcon } from '../../components/ConnectorIcon';
import { StyledIcon } from '../../components/Icons/StyledIcon';
import styles from './SnapshotCard.module.css';

export const SnapshotCard = ({ snapshot }: { snapshot: Snapshot }) => {
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
        title: 'Snapshot abandoned',
        message: 'The snapshot and its data have been deleted.',
      });
      modalStack.close('confirm-delete');
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Deletion failed',
        message: 'There was an error deleting the snapshot.',
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
        message: 'The snapshot has been renamed.',
      });
      modalStack.close('rename');
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Renaming failed',
        message: 'There was an error renaming the snapshot.',
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
      <Modal {...modalStack.register('confirm-delete')} title="Abandon snapshot" centered size="lg">
        <Stack>
          <Text>Are you sure you want to abandon this snapshot? All data will be deleted.</Text>
          <Group justify="flex-end">
            <SecondaryButton onClick={() => modalStack.close('confirm-delete')}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleAbandon} loading={saving}>
              Delete
            </PrimaryButton>
          </Group>
        </Stack>
      </Modal>
      <Modal {...modalStack.register('rename')} title="Rename snapshot" centered size="lg">
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
      <Card
        shadow="sm"
        p="xs"
        radius="md"
        withBorder
        key={snapshot.id}
        onClick={() => router.push(RouteUrls.snapshotPage(snapshot.id))}
        className={styles.snapshotCard}
      >
        <Grid align="center">
          <Grid.Col span={1}>
            <ConnectorIcon connector={snapshot.connectorService} />
          </Grid.Col>
          <Grid.Col span={5}>
            <Text>{snapshot.name}</Text>
          </Grid.Col>
          <Grid.Col span={2}>
            <Text fz="sm" c="dimmed">
              {snapshot.tables.length} {pluralize('table', snapshot.tables.length)}
            </Text>
          </Grid.Col>
          <Grid.Col span={3}>
            <Text fz="sm" c="dimmed">
              Created {new Date(snapshot.createdAt).toLocaleString()}
            </Text>
          </Grid.Col>
          <Grid.Col span={1}>
            <Group justify="flex-end">{menu}</Group>
          </Grid.Col>
        </Grid>
      </Card>
    </>
  );
};
