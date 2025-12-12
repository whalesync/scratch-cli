'use client';

import { Text13Medium } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { serviceName } from '@/service-naming-conventions';
import { Group, Menu, Table } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { AuthType, ConnectorHealthStatus, Service } from '@spinner/shared-types';
import { ArrowLeftRightIcon, Plus, RefreshCcwIcon, SquarePenIcon, Trash2 } from 'lucide-react';
import { ConnectorAccount } from '../../../types/server-entities/connector-accounts';
import { ActionIconThreeDots } from '../../components/base/action-icons';
import { Badge, BadgeError, BadgeOK } from '../../components/base/badge';
import { RelativeDate } from '../../components/RelativeDate';
import { CreateWorkbookModal } from './CreateWorkbookModal';

interface ConnectorRowProps {
  connectorAccount: ConnectorAccount;
  onTest: (con: ConnectorAccount) => void;
  onUpdate: (conn: ConnectorAccount) => void;
  onReauthorize: (conn: ConnectorAccount) => void;
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

export function ConnectorRow({
  connectorAccount,
  onTest,
  onUpdate,
  onDelete,
  onReauthorize,
  testingId,
}: ConnectorRowProps) {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <CreateWorkbookModal connectorAccount={connectorAccount} opened={opened} onClose={close} />
      <Table.Tr key={connectorAccount.id}>
        <Table.Td>
          <Group gap="sm">
            <ConnectorIcon size={24} connector={connectorAccount.service} withBorder />
            <Text13Medium>{connectorAccount.displayName || serviceName(connectorAccount.service)}</Text13Medium>
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
                <Menu.Item leftSection={<SquarePenIcon size={16} />} onClick={() => onUpdate(connectorAccount)}>
                  {connectorAccount.authType === AuthType.OAUTH || connectorAccount.service === Service.CSV
                    ? 'Rename'
                    : 'Edit'}
                </Menu.Item>
                {connectorAccount.authType === AuthType.OAUTH && (
                  <Menu.Item
                    leftSection={<ArrowLeftRightIcon size={16} />}
                    onClick={() => onReauthorize(connectorAccount)}
                  >
                    Reauthorize
                  </Menu.Item>
                )}
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
