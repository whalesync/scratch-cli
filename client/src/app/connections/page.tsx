'use client';

import { useCustomConnectors } from '@/hooks/use-custom-connector';
import { ConnectorAccount, Service } from '@/types/server-entities/connector-accounts';
import { Alert, Button, Container, Group, Loader, Modal, Paper, Select, Stack, TextInput, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { WarningCircleIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useConnectorAccounts } from '../../hooks/use-connector-account';
import { ConnectorAccountRow } from './ConnectorAccountRow';

export default function ConnectorAccountsPage() {
  const {
    isLoading,
    error,
    connectorAccounts,
    createConnectorAccount,
    deleteConnectorAccount,
    updateConnectorAccount,
    testConnection,
  } = useConnectorAccounts();

  const { data: customConnectors } = useCustomConnectors();

  // State for the creation form
  const [newApiKey, setNewApiKey] = useState('');
  const [newService, setNewService] = useState<Service | null>(null);
  const [newModifier, setNewModifier] = useState<string | null>(null);

  // State for the update modal
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedConnectorAccount, setSelectedConnectorAccount] = useState<ConnectorAccount | null>(null);
  const [updatedName, setUpdatedName] = useState('');
  const [updatedApiKey, setUpdatedApiKey] = useState('');
  const [updatedModifier, setUpdatedModifier] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newService) {
      alert('Service is required.');
      return;
    }
    if (newService !== Service.CSV && !newApiKey) {
      alert('API key is required for this service.');
      return;
    }
    const newAccount = await createConnectorAccount({
      service: newService,
      apiKey: newService === Service.CSV ? '' : newApiKey,
      modifier: newModifier || undefined,
    });
    setNewApiKey('');
    setNewService(null);
    setNewModifier(null);
    if (newAccount && newAccount.id) {
      await handleTest(newAccount.id);
    }
  };

  const handleOpenUpdateModal = (conn: ConnectorAccount) => {
    setSelectedConnectorAccount(conn);
    setUpdatedName(conn.displayName);
    setUpdatedApiKey(conn.apiKey);
    setUpdatedModifier(conn.modifier);
    open();
  };

  const handleUpdate = async () => {
    if (!selectedConnectorAccount) return;

    await updateConnectorAccount(selectedConnectorAccount.id, {
      displayName: updatedName,
      apiKey: selectedConnectorAccount.service === Service.CSV ? '' : updatedApiKey,
      modifier: updatedModifier || undefined,
    });
    close();
  };

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

  if (isLoading) {
    return (
      <Container>
        <Loader />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert icon={<WarningCircleIcon size="1rem" />} title="Error!" color="red">
          Failed to load connections. Please try again later.
        </Alert>
      </Container>
    );
  }

  return (
    <>
      <Modal opened={opened} onClose={close} title="Update Connection">
        <Stack>
          <TextInput label="Display Name" value={updatedName} onChange={(e) => setUpdatedName(e.currentTarget.value)} />
          {selectedConnectorAccount?.service !== Service.CSV && (
            <TextInput
              label="API Key"
              value={updatedApiKey}
              onChange={(e) => setUpdatedApiKey(e.currentTarget.value)}
            />
          )}
          {selectedConnectorAccount?.service === Service.CUSTOM && customConnectors && (
            <Select
              label="Custom Connector"
              placeholder="Select a custom connector (optional)"
              data={customConnectors.map((connector) => ({
                value: connector.id,
                label: connector.name,
              }))}
              value={updatedModifier}
              onChange={setUpdatedModifier}
              clearable
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save</Button>
          </Group>
        </Stack>
      </Modal>

      <Stack p="lg">
        <Title order={2}>Connections</Title>

        {connectorAccounts && connectorAccounts.length > 0 && (
          <>
            <Title order={3}>Existing </Title>
            <Stack>
              {connectorAccounts?.map((conn) => (
                <ConnectorAccountRow
                  key={conn.id}
                  connectorAccount={conn}
                  onTest={handleTest}
                  onUpdate={handleOpenUpdateModal}
                  onDelete={deleteConnectorAccount}
                  testingId={testingId}
                />
              ))}
            </Stack>
          </>
        )}

        <Paper withBorder shadow="md" p="md">
          <Stack>
            <Title order={2}>Create New Connection</Title>
            <Select
              label="Service"
              placeholder="Pick a service"
              data={Object.values(Service)}
              value={newService}
              onChange={(value) => setNewService(value as Service)}
            />
            {newService === Service.CSV && (
              <Alert color="blue" title="CSV Connection">
                CSV connections allow you to work with CSV files uploaded to your account. No API key is required.
              </Alert>
            )}
            {newService !== Service.CSV && (
              <TextInput
                label="API Key"
                placeholder="Enter API Key"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.currentTarget.value)}
              />
            )}
            {newService === Service.CUSTOM && customConnectors && (
              <Select
                label="Custom Connector"
                placeholder="Select a custom connector (optional)"
                data={customConnectors.map((connector) => ({
                  value: connector.id,
                  label: connector.name,
                }))}
                value={newModifier}
                onChange={setNewModifier}
                clearable
              />
            )}
            <Button onClick={handleCreate}>Create</Button>
          </Stack>
        </Paper>
      </Stack>
    </>
  );
}
