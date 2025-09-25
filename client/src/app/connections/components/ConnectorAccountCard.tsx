'use client';

import { PrimaryButton } from '@/app/components/base/buttons';
import { TextTitleSm } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { useSnapshots } from '@/hooks/use-snapshot';
import { serviceName } from '@/service-naming-conventions';
import { ConnectorAccount, ConnectorHealthStatus } from '@/types/server-entities/connector-accounts';
import { RouteUrls } from '@/utils/route-urls';
import { ActionIcon, Button, Card, Divider, Group, Loader, Stack, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { CheckCircle, Edit3, HelpCircle, Plus, TestTube, Trash2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CreateSnapshotModal } from './CreateSnapshotModal';

interface ConnectorAccountCardProps {
  connectorAccount: ConnectorAccount;
  onTest: (id: string) => void;
  onUpdate: (conn: ConnectorAccount) => void;
  onDelete: (id: string) => void;
  testingId: string | null;
}

/**
 * @deprecated Use ConnectorRow instead
 */
export function ConnectorAccountCard({
  connectorAccount,
  onTest,
  onUpdate,
  onDelete,
  testingId,
}: ConnectorAccountCardProps) {
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
      icon = <StyledLucideIcon Icon={HelpCircle} />;
      testButton = (
        <Tooltip label="Test connection" position="bottom">
          <ActionIcon variant="subtle" size="xs" onClick={() => onTest(c.id)} loading={testingId === c.id}>
            <StyledLucideIcon Icon={TestTube} />
          </ActionIcon>
        </Tooltip>
      );
    }

    if (c.healthStatus === ConnectorHealthStatus.OK) {
      text = `Connection OK`;
      color = 'green';
      icon = <StyledLucideIcon Icon={CheckCircle} />;
    }

    if (c.healthStatus === ConnectorHealthStatus.FAILED) {
      text = `Connection problem`;
      color = 'red';
      icon = <StyledLucideIcon Icon={XCircle} />;
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
              <TextTitleSm>{serviceName(connectorAccount.service)}</TextTitleSm>
            </Group>
            <Group justify="flex-end">
              <HealthIcon {...connectorAccount} />
              <ActionIcon variant="subtle" size="xs" onClick={() => onUpdate(connectorAccount)}>
                <StyledLucideIcon Icon={Edit3} />
              </ActionIcon>
              <ActionIcon variant="subtle" size="xs" onClick={() => onDelete(connectorAccount.id)}>
                <StyledLucideIcon Icon={Trash2} />
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
              <PrimaryButton size="xs" onClick={open} leftSection={<StyledLucideIcon Icon={Plus} size={12} />}>
                New scratchpaper
              </PrimaryButton>
            </Group>
          </>
        </Stack>
      </Card>
    </>
  );
}
