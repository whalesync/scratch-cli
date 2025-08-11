import { Snapshot } from '@/types/server-entities/snapshot';
import { RouteUrls } from '@/utils/route-urls';
import { ActionIcon, Card, Grid, Menu, Text } from '@mantine/core';
import { DotsThreeCircleIcon, PencilSimpleLineIcon, TrashIcon } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import pluralize from 'pluralize';
import { ConnectorIcon } from './ConnectorIcon';
import { StyledIcon } from './Icons/StyledIcon';
import styles from './SnapshotCard.module.css';

export const SnapshotCard = ({ snapshot }: { snapshot: Snapshot }) => {
  const router = useRouter();

  const menuItems = [
    <Menu.Item key="rename" leftSection={<PencilSimpleLineIcon />} onClick={() => {}}>
      Rename
    </Menu.Item>,
    <Menu.Item key="delete" leftSection={<TrashIcon />} color="red" onClick={() => {}}>
      Delete
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
          <StyledIcon Icon={DotsThreeCircleIcon} c="gray" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>{menuItems}</Menu.Dropdown>
    </Menu>
  );

  return (
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
        <Grid.Col span={1}>{menu}</Grid.Col>
      </Grid>
    </Card>
  );
};
