'use client';

import { TextTitleSm } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useSnapshots } from '@/hooks/use-snapshot';
import { serviceName } from '@/service-naming-conventions';
import { ConnectorAccount, ConnectorHealthStatus } from '@/types/server-entities/connector-accounts';
import { formatDate } from '@/utils/helpers';
import { Group, Loader, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { CheckCircle, Edit3, HelpCircle, Plus, TestTubeIcon, Trash2, XCircle } from 'lucide-react';
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
      icon = <StyledLucideIcon Icon={HelpCircle} />;
      testButton = (
        <ToolIconButton
          size="md"
          onClick={() => onTest(c.id)}
          loading={testingId === c.id}
          icon={TestTubeIcon}
          tooltip="Test connection"
        />
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
            <ToolIconButton size="md" onClick={open} icon={Plus} tooltip="Create a Scratchpaper" />
            <ToolIconButton
              size="md"
              onClick={() => onUpdate(connectorAccount)}
              icon={Edit3}
              tooltip="Edit connector"
            />
            <ToolIconButton
              size="md"
              onClick={() => onDelete(connectorAccount.id)}
              icon={Trash2}
              tooltip="Delete connector"
            />
          </Group>
        </Table.Td>
      </Table.Tr>
    </>
  );
}
