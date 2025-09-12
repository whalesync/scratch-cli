'use client';

import { ConnectorAccount } from '@/types/server-entities/connector-accounts';
import { Center, Group, Loader, Modal, Stack, Text, useModalsStack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useConnectorAccounts } from '../../hooks/use-connector-account';
import { PrimaryButton, SecondaryButton } from '../components/base/buttons';
import { TextRegularSm } from '../components/base/text';
import { ErrorInfo } from '../components/InfoPanel';
import MainContent from '../components/layouts/MainContent';
import { ConnectorAccountRow } from './components/ConnectorAccountRow';
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

  const headerActions = (
    <SecondaryButton size="xs" leftSection={<PlusIcon size={16} />} onClick={() => modalStack.open('create')}>
      New Connection
    </SecondaryButton>
  );

  return (
    <MainContent>
      <MainContent.BasicHeader title="Connections" actions={headerActions} />
      <MainContent.Body>
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

        <Stack maw="1000px">
          {connectorAccounts && connectorAccounts.length > 0 && (
            <>
              {connectorAccounts?.map((conn) => (
                <ConnectorAccountRow
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
            </>
          )}
        </Stack>
      </MainContent.Body>
    </MainContent>
  );
}
