'use client';

import { PrimaryButton } from '@/app/components/base/buttons';
import { TextTitleSm } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { useSnapshots } from '@/hooks/use-snapshot';
import { ConnectorAccount, ConnectorHealthStatus } from '@/types/server-entities/connector-accounts';
import { RouteUrls } from '@/utils/route-urls';
import { ActionIcon, Button, Card, Divider, Group, Loader, Stack, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  CheckCircleIcon,
  PencilSimpleLineIcon,
  QuestionIcon,
  TestTubeIcon,
  TrashIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { CreateSnapshotModal } from './CreateSnapshotModal';

interface ConnectorAccountRowProps {
  connectorAccount: ConnectorAccount;
  onTest: (id: string) => void;
  onUpdate: (conn: ConnectorAccount) => void;
  onDelete: (id: string) => void;
  testingId: string | null;
}

export function ConnectorAccountRow({
  connectorAccount,
  onTest,
  onUpdate,
  onDelete,
  testingId,
}: ConnectorAccountRowProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const router = useRouter();

  const { snapshots, isLoading: isLoadingSnapshots } = useSnapshots(connectorAccount.id);

  const HealthIcon = (c: ConnectorAccount) => {
    let text = '';
    let color = 'gray';
    let icon = <></>;
    let testButton = null;
    if (!c.healthStatus || !c.healthStatusLastCheckedAt) {
      text = 'Connection status unknown';
      color = 'gray';
      icon = <QuestionIcon />;
      testButton = (
        <Tooltip label="Test connection" position="bottom">
          <ActionIcon variant="subtle" size="xs" onClick={() => onTest(c.id)} loading={testingId === c.id}>
            <TestTubeIcon />
          </ActionIcon>
        </Tooltip>
      );
    }

    if (c.healthStatus === ConnectorHealthStatus.OK) {
      text = `Connection OK`;
      color = 'green';
      icon = <CheckCircleIcon />;
    }

    if (c.healthStatus === ConnectorHealthStatus.FAILED) {
      text = `Connection problem`;
      color = 'red';
      icon = <XCircleIcon />;
    }

    return (
      <Group c={color} gap="xs">
        {icon}
        <Text size="sm">{text}</Text>
        {testButton}
      </Group>
    );
  };

  return (
    <>
      <CreateSnapshotModal connectorAccount={connectorAccount} opened={opened} onClose={close} />
      <Card shadow="sm" p={0} radius="md" withBorder key={connectorAccount.id}>
        <Stack p={0} gap="xs">
          <Group justify="space-between" p="xs">
            <Group gap="sm">
              <ConnectorIcon connector={connectorAccount.service} />
              <TextTitleSm>{connectorAccount.displayName}</TextTitleSm>
            </Group>
            <Group justify="flex-end">
              <HealthIcon {...connectorAccount} />
              <ActionIcon variant="subtle" size="xs" onClick={() => onUpdate(connectorAccount)}>
                <PencilSimpleLineIcon />
              </ActionIcon>
              <ActionIcon variant="subtle" size="xs" onClick={() => onDelete(connectorAccount.id)}>
                <TrashIcon />
              </ActionIcon>
            </Group>
          </Group>
          {isLoadingSnapshots ? (
            <Group p="xs">
              <Loader size="sm" />
            </Group>
          ) : null}

          <>
            <Divider />
            <Group justify="space-between" p="xs">
              <Group>
                {snapshots?.map((snapshot) => (
                  <Button
                    size="xs"
                    variant="transparent"
                    p="2px"
                    key={snapshot.id}
                    onClick={() => router.push(RouteUrls.snapshotPage(snapshot.id))}
                  >
                    {snapshot.name}
                  </Button>
                ))}
              </Group>
              <PrimaryButton size="xs" onClick={open}>
                New snapshot
              </PrimaryButton>
            </Group>
          </>
        </Stack>
      </Card>
    </>
  );
}

/**
 
<Paper withBorder shadow="sm" p="md" key={connectorAccount.id}>
        <Stack>
          <Group>
            <Title order={3}></Title>
            <Button variant="outline" onClick={() => onUpdate(connectorAccount)} ml="auto">
              Edit
            </Button>

            <Button color="red" onClick={() => onDelete(connectorAccount.id)}>
              Delete
            </Button>
          </Group>
          <Divider />
          <Group gap="xs">
            
            <Button
              variant="subtle"
              onClick={() => onTest(connectorAccount.id)}
              loading={testingId === connectorAccount.id}
              size="xs"
            >
              Test
            </Button>
          </Group>
          <Group justify="flex-end">
            {isLoadingSnapshots ? (
              <Loader size="sm" />
            ) : (
              <Stack align="flex-end">
                {snapshots?.map((snapshot) => (
                  <Button key={snapshot.id} onClick={() => handleWorkWithSnapshot(snapshot.id)} variant="outline">
                    View {snapshot.name}
                  </Button>
                ))}

                <Button onClick={open}>Start new scratchpaper</Button>
              </Stack>
            )}
          </Group>
        </Stack>
      </Paper>

 */
