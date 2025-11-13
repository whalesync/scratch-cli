'use client';

import { TextSmHeavier } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { serviceName } from '@/service-naming-conventions';
import { ConnectorAccount, ConnectorHealthStatus } from '@/types/server-entities/connector-accounts';
import { Group, Menu, Table } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Badge, Edit3, Plus, RefreshCcwIcon, Trash2 } from 'lucide-react';
import { ActionIconThreeDots } from '../../components/base/action-icons';
import { BadgeError, BadgeOK } from '../../components/base/badges';
import { RelativeDate } from '../../components/RelativeDate';
import { CreateSnapshotModal } from './CreateSnapshotModal';

interface ConnectorRowProps {
  connectorAccount: ConnectorAccount;
  onTest: (con: ConnectorAccount) => void;
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
  return <Badge>Unknown</Badge>;
};

export function ConnectorRow({ connectorAccount, onTest, onUpdate, onDelete, testingId }: ConnectorRowProps) {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <CreateSnapshotModal connectorAccount={connectorAccount} opened={opened} onClose={close} />
      <Table.Tr key={connectorAccount.id}>
        <Table.Td>
          <Group gap="sm">
            <ConnectorIcon size={24} connector={connectorAccount.service} withBorder />
            <TextSmHeavier>{connectorAccount.displayName || serviceName(connectorAccount.service)}</TextSmHeavier>
          </Group>
        </Table.Td>
        <Table.Td>App</Table.Td>
        <Table.Td>
          <HealthIcon c={connectorAccount} />
        </Table.Td>
        <Table.Td>
          <RelativeDate date={connectorAccount.createdAt} />
        </Table.Td>
        <Table.Td align="right">
          <Group gap="xs" justify="flex-end">
            <ToolIconButton onClick={open} icon={Plus} tooltip="Create a workbook" />
            <ToolIconButton
              onClick={() => onTest(connectorAccount)}
              loading={testingId === connectorAccount.id}
              icon={RefreshCcwIcon}
              tooltip={
                testingId === connectorAccount.id
                  ? `Contacting ${serviceName(connectorAccount.service)}...`
                  : 'Test connection'
              }
            />
            <Menu>
              <Menu.Target>
                <ActionIconThreeDots />
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<Edit3 size={16} />} onClick={() => onUpdate(connectorAccount)}>
                  Rename
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item data-delete leftSection={<Trash2 size={16} />} onClick={() => onDelete(connectorAccount.id)}>
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Table.Td>
      </Table.Tr>
    </>
  );
}
