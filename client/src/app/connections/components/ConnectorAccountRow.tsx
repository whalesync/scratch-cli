'use client';

import { useSnapshots } from '@/hooks/use-snapshot';
import { ConnectorAccount, ConnectorHealthStatus } from '@/types/server-entities/connector-accounts';
import { RouteUrls } from '@/utils/route-urls';
import { Badge, Button, Divider, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { CheckCircleIcon, QuestionIcon, XCircleIcon } from '@phosphor-icons/react';
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

  const handleWorkWithSnapshot = (id: string) => {
    router.push(RouteUrls.snapshotPage(id));
  };

  const HealthIcon = (c: ConnectorAccount) => {
    let text = '';
    let color = 'gray';
    let icon = <></>;
    if (!c.healthStatus || !c.healthStatusLastCheckedAt) {
      text = 'Connection status unknown';
      color = 'gray';
      icon = <QuestionIcon />;
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
      </Group>
    );
  };

  return (
    <>
      <CreateSnapshotModal connectorAccount={connectorAccount} opened={opened} onClose={close} />
      <Paper withBorder shadow="sm" p="md" key={connectorAccount.id}>
        <Stack>
          <Group>
            <Badge variant="outline" color="yellow" radius="xs">
              {connectorAccount.service}
            </Badge>
            <Title order={3}>{connectorAccount.displayName}</Title>
            <Button variant="outline" onClick={() => onUpdate(connectorAccount)} ml="auto">
              Edit
            </Button>

            <Button color="red" onClick={() => onDelete(connectorAccount.id)}>
              Delete
            </Button>
          </Group>
          <Divider />
          <Group gap="xs">
            <HealthIcon {...connectorAccount} />
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

                <Button onClick={open}>Start new snapshot</Button>
              </Stack>
            )}
          </Group>
        </Stack>
      </Paper>
    </>
  );
}
