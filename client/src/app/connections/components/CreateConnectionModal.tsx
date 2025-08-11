import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { useConnectorAccounts } from '@/hooks/use-connector-account';
import { useCustomConnectors } from '@/hooks/use-custom-connector';
import { Service } from '@/types/server-entities/connector-accounts';
import { Alert, Group, Modal, ModalProps, Select, Stack, TextInput } from '@mantine/core';
import { useState } from 'react';

export const CreateConnectionModal = (props: ModalProps) => {
  const [newApiKey, setNewApiKey] = useState('');
  const [newService, setNewService] = useState<Service | null>(null);
  const [newModifier, setNewModifier] = useState<string | null>(null);

  const { createConnectorAccount } = useConnectorAccounts();
  const { data: customConnectors } = useCustomConnectors();

  const handleCreate = async () => {
    if (!newService) {
      alert('Service is required.');
      return;
    }
    if (newService !== Service.CSV && !newApiKey) {
      alert('API key is required for this service.');
      return;
    }
    await createConnectorAccount({
      service: newService,
      apiKey: newService === Service.CSV ? '' : newApiKey,
      modifier: newModifier || undefined,
    });
    setNewApiKey('');
    setNewService(null);
    setNewModifier(null);
    // if (newAccount && newAccount.id) {
    //   await handleTest(newAccount.id);
    // }
    props.onClose?.();
  };

  return (
    <Modal title="Create Connection" size="xl" centered {...props}>
      <Stack>
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
        <Group justify="flex-end">
          <SecondaryButton onClick={props.onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleCreate}>Create</PrimaryButton>
        </Group>
      </Stack>
    </Modal>
  );
};
