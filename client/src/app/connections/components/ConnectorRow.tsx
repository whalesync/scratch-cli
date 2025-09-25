'use client';

import { TextTitleSm } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { useSnapshots } from '@/hooks/use-snapshot';
import { serviceName } from '@/service-naming-conventions';
import { ConnectorAccount, ConnectorHealthStatus } from '@/types/server-entities/connector-accounts';
import { formatDate } from '@/utils/helpers';
import { ActionIcon, Group, Loader, Table, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { CheckCircleIcon, QuestionIcon, TestTubeIcon, XCircleIcon } from '@phosphor-icons/react';
import { PencilLineIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { CreateSnapshotModal } from './CreateSnapshotModal';

interface ConnectorRowProps {
  connectorAccount: ConnectorAccount;
  onTest: (id: string) => void;
  onUpdate: (conn: ConnectorAccount) => void;
  onDelete: (id: string) => void;
  testingId: string | null;
}

export function ConnectorRow({ connectorAccount, onTest, onUpdate, onDelete, testingId }: ConnectorRowProps) {
  const [opened, { open, close }] = useDisclosure(false);

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
      <Table.Tr key={connectorAccount.id}>
        <Table.Td>
          <Group gap="sm">
            <ConnectorIcon size={24} connector={connectorAccount.service} />
            <TextTitleSm>{serviceName(connectorAccount.service)}</TextTitleSm>
          </Group>
        </Table.Td>
        <Table.Td>
          {isLoadingSnapshots ? (
            <Group p="xs">
              <Loader size="xs" />
            </Group>
          ) : (
            <Text fz="sm" c="dimmed">
              {snapshots?.length}
            </Text>
          )}
        </Table.Td>
        <Table.Td>
          <HealthIcon {...connectorAccount} />
        </Table.Td>
        <Table.Td>{formatDate(connectorAccount.updatedAt)}</Table.Td>
        <Table.Td align="right">
          <Group gap="xs" justify="flex-end">
            <ActionIcon variant="subtle" size="xs" onClick={open}>
              <PlusIcon />
            </ActionIcon>
            <ActionIcon variant="subtle" size="xs" onClick={() => onUpdate(connectorAccount)}>
              <PencilLineIcon />
            </ActionIcon>
            <ActionIcon variant="subtle" size="xs" onClick={() => onDelete(connectorAccount.id)}>
              <Trash2Icon />
            </ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>
    </>
  );
}
