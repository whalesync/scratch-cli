'use client';

import { TextMdHeavier, TextSmRegular } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useSnapshots } from '@/hooks/use-snapshots';
import { serviceName } from '@/service-naming-conventions';
import { ConnectorAccount, ConnectorHealthStatus } from '@/types/server-entities/connector-accounts';
import { formatDate } from '@/utils/helpers';
import { Group, Loader, Table } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Edit3, Plus, RefreshCcwIcon, Trash2 } from 'lucide-react';
import { BadgeBase, BadgeError, BadgeOK } from '../../components/base/badges';
import { CreateSnapshotModal } from './CreateSnapshotModal';

interface ConnectorRowProps {
  connectorAccount: ConnectorAccount;
  onTest: (id: string) => void;
  onUpdate: (conn: ConnectorAccount) => void;
  onDelete: (id: string) => void;
  testingId: string | null;
}

const HealthIcon = ({ c }: { c: ConnectorAccount }) => {
  if (c.healthStatus && c.healthStatusLastCheckedAt) {
    if (c.healthStatus === ConnectorHealthStatus.OK) {
      return <BadgeOK>Connected</BadgeOK>;
    }
    if (c.healthStatus === ConnectorHealthStatus.FAILED) {
      return <BadgeError>Error</BadgeError>;
    }
  }
  return <BadgeBase>Unknown</BadgeBase>;
};

export function ConnectorRow({ connectorAccount, onTest, onUpdate, onDelete, testingId }: ConnectorRowProps) {
  const [opened, { open, close }] = useDisclosure(false);

  const { snapshots, isLoading: isLoadingSnapshots } = useSnapshots(connectorAccount.id);

  return (
    <>
      <CreateSnapshotModal connectorAccount={connectorAccount} opened={opened} onClose={close} />
      <Table.Tr key={connectorAccount.id}>
        <Table.Td>
          <Group gap="sm">
            <ConnectorIcon size={24} connector={connectorAccount.service} withBorder />
            <TextMdHeavier>{connectorAccount.displayName || serviceName(connectorAccount.service)}</TextMdHeavier>
          </Group>
        </Table.Td>
        <Table.Td>
          <HealthIcon c={connectorAccount} />
        </Table.Td>
        <Table.Td>
          {isLoadingSnapshots ? (
            <Group p="xs">
              <Loader size="xs" />
            </Group>
          ) : (
            <TextSmRegular>{snapshots?.length}</TextSmRegular>
          )}
        </Table.Td>
        <Table.Td>
          <TextSmRegular>{formatDate(connectorAccount.createdAt)}</TextSmRegular>
        </Table.Td>
        <Table.Td align="right">
          <Group gap="xs" justify="flex-end">
            <ToolIconButton size="md" onClick={open} icon={Plus} tooltip="Create a workbook" />
            <ToolIconButton
              size="md"
              onClick={() => onUpdate(connectorAccount)}
              icon={Edit3}
              tooltip="Edit connector"
            />
            <ToolIconButton
              size="md"
              onClick={() => onTest(connectorAccount.id)}
              loading={testingId === connectorAccount.id}
              icon={RefreshCcwIcon}
              tooltip="Verify connection"
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
