'use client';

import { ConnectorAccount } from '@/types/server-entities/connector-accounts';
import { Group, Loader, Modal, Stack, Table, Text, useModalsStack } from '@mantine/core';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useConnectorAccounts } from '../../../hooks/use-connector-account';
import { ButtonPrimaryLight, ButtonPrimarySolid, ButtonSecondaryOutline } from '../../components/base/buttons';
import { TextMono13Regular } from '../../components/base/text';
import { ErrorInfo } from '../../components/InfoPanel';
import { ScratchpadNotifications } from '../../components/ScratchpadNotifications';
import { ConnectorRow } from './ConnectorRow';
import { CreateConnectionModal } from './CreateConnectionModal';
import { UpdateConnectionModal } from './UpdateConnectionModal';

export default function ConnectorTable() {
  const { isLoading, error, connectorAccounts, deleteConnectorAccount, testConnection } = useConnectorAccounts();

  // State for the update modal
  const [selectedConnectorAccount, setSelectedConnectorAccount] = useState<ConnectorAccount | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const modalStack = useModalsStack(['create', 'update', 'confirm-delete']);

  const handleTest = async (con: ConnectorAccount) => {
    setTestingId(con.id);
    await testConnection(con);
    setTestingId(null);
  };

  const handleDelete = async () => {
    if (!selectedConnectorAccount) return;
    setIsDeleting(true);
    try {
      await deleteConnectorAccount(selectedConnectorAccount.id);
      setSelectedConnectorAccount(null);
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Error',
        message: 'Failed to delete connection',
        autoClose: 5000,
      });
    } finally {
      setIsDeleting(false);
      modalStack.close('confirm-delete');
    }
  };

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return <ErrorInfo error={error} />;
  }

  const sortedConnectorAccounts = connectorAccounts?.sort((a, b) => a.displayName.localeCompare(b.displayName)) || [];

  return (
    <>
      <CreateConnectionModal {...modalStack.register('create')} />
      <UpdateConnectionModal {...modalStack.register('update')} connectorAccount={selectedConnectorAccount} />
      <Modal {...modalStack.register('confirm-delete')} title="Delete data source" centered size="lg">
        <Stack>
          <Text>Are you sure you want to delete this data source and associated workbooks?</Text>
          <Group justify="flex-end">
            <ButtonSecondaryOutline onClick={() => modalStack.close('confirm-delete')}>Cancel</ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleDelete} loading={isDeleting}>
              Delete
            </ButtonPrimaryLight>
          </Group>
        </Stack>
      </Modal>
      <Group justify="space-between" align="top" mt="md">
        <TextMono13Regular c="dimmed">CONNECTED APPS</TextMono13Regular>
        <ButtonPrimarySolid leftSection={<PlusIcon />} onClick={() => modalStack.open('create')}>
          New connection
        </ButtonPrimarySolid>
      </Group>

      <Table ml="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Td>Name</Table.Td>
            <Table.Td w="10%">Type</Table.Td>
            <Table.Td w="20%">Status</Table.Td>
            <Table.Td w="20%">Created</Table.Td>
            <Table.Td w="120px" align="right"></Table.Td>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sortedConnectorAccounts.map((conn) => (
            <ConnectorRow
              key={conn.id}
              connectorAccount={conn}
              onTest={handleTest}
              onUpdate={(conn) => {
                setSelectedConnectorAccount(conn);
                modalStack.open('update');
              }}
              onDelete={() => {
                setSelectedConnectorAccount(conn);
                modalStack.open('confirm-delete');
              }}
              testingId={testingId}
            />
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
}
