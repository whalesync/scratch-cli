'use client';

import { ConnectorAccount } from '@/types/server-entities/connector-accounts';
import { Center, Group, Loader, Modal, Stack, Table, Text, useModalsStack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useConnectorAccounts } from '../../hooks/use-connector-account';
import { ContentFooterButton, PrimaryButton, SecondaryButton } from '../components/base/buttons';
import { TextRegularSm } from '../components/base/text';
import { ErrorInfo } from '../components/InfoPanel';
import MainContent from '../components/layouts/MainContent';
import { ConnectorRow } from './components/ConnectorRow';
import { CreateConnectionModal } from './components/CreateConnectionModal';
import { UpdateConnectionModal } from './components/UpdateConnectionModal';

export default function ConnectorAccountsPage() {
  const { isLoading, error, connectorAccounts, deleteConnectorAccount, testConnection } = useConnectorAccounts();

  // State for the update modal
  const [selectedConnectorAccount, setSelectedConnectorAccount] = useState<ConnectorAccount | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const modalStack = useModalsStack(['create', 'update', 'confirm-delete']);

  const handleTest = async (id: string) => {
    setTestingId(id);
    const r = await testConnection(id);
    if (r.health === 'error') {
      notifications.show({
        title: 'Connection Test Failed',
        message: r.error,
        color: 'red',
      });
    } else {
      notifications.show({
        title: 'Connection Test Succeeded',
        message: 'Successfully connected to the service.',
        color: 'green',
      });
    }
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
      notifications.show({
        title: 'Error',
        message: 'Failed to delete connection.',
        color: 'red',
      });
    } finally {
      setIsDeleting(false);
      modalStack.close('confirm-delete');
    }
  };

  if (isLoading) {
    return (
      <Center h="100%">
        <Loader />
        <TextRegularSm>Loading connections...</TextRegularSm>
      </Center>
    );
  }

  if (error) {
    return <ErrorInfo error={error} />;
  }

  return (
    <MainContent>
      <MainContent.BasicHeader title="Connections" />
      <MainContent.Body p="0">
        <CreateConnectionModal {...modalStack.register('create')} />
        <UpdateConnectionModal {...modalStack.register('update')} connectorAccount={selectedConnectorAccount} />
        <Modal {...modalStack.register('confirm-delete')} title="Delete Connection" centered size="lg">
          <Stack>
            <Text>Are you sure you want to delete this connection and associated scratchpapers?</Text>
            <Group justify="flex-end">
              <SecondaryButton onClick={() => modalStack.close('confirm-delete')}>Cancel</SecondaryButton>
              <PrimaryButton onClick={handleDelete} loading={isDeleting}>
                Delete
              </PrimaryButton>
            </Group>
          </Stack>
        </Modal>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Td>Name</Table.Td>
              <Table.Td>Scratchpapers</Table.Td>
              <Table.Td>Health</Table.Td>
              <Table.Td>Updated</Table.Td>
              <Table.Td align="right">Actions</Table.Td>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {connectorAccounts?.map((conn) => (
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
      </MainContent.Body>
      <MainContent.Footer>
        <ContentFooterButton leftSection={<PlusIcon size={16} />} onClick={() => modalStack.open('create')}>
          New connection
        </ContentFooterButton>
      </MainContent.Footer>
    </MainContent>
  );
}
