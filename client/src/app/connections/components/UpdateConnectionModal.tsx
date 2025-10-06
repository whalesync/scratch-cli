import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { useConnectorAccounts } from '@/hooks/use-connector-account';
import { useCustomConnectors } from '@/hooks/use-custom-connector';
import { AuthType, ConnectorAccount, Service } from '@/types/server-entities/connector-accounts';
import { Alert, Group, Modal, ModalProps, Select, Stack, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';

interface UpdateConnectionModalProps extends ModalProps {
  connectorAccount: ConnectorAccount | null;
}

export const UpdateConnectionModal = (props: UpdateConnectionModalProps) => {
  const { connectorAccount, ...modalProps } = props;
  const [updatedName, setUpdatedName] = useState('');
  const [updatedApiKey, setUpdatedApiKey] = useState('');
  const [updatedModifier, setUpdatedModifier] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { updateConnectorAccount } = useConnectorAccounts();
  const { data: customConnectors } = useCustomConnectors();

  useEffect(() => {
    if (connectorAccount) {
      setUpdatedName(connectorAccount.displayName);
      setUpdatedApiKey(connectorAccount.apiKey);
      setUpdatedModifier(connectorAccount.modifier);
    }
  }, [connectorAccount]);

  const handleUpdate = async () => {
    if (!connectorAccount) return;
    setIsSaving(true);
    try {
      await updateConnectorAccount(connectorAccount.id, {
        displayName: updatedName,
        apiKey: connectorAccount.service === Service.CSV ? '' : updatedApiKey,
        modifier: updatedModifier || undefined,
      });
      props.onClose?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Update Connection" centered size="lg" {...modalProps}>
      <Stack>
        {error && <Alert color="red">{error}</Alert>}
        <TextInput label="Display Name" value={updatedName} onChange={(e) => setUpdatedName(e.currentTarget.value)} />
        {connectorAccount?.authType === AuthType.API_KEY && connectorAccount?.service !== Service.CSV && (
          <TextInput label="API Key" value={updatedApiKey} onChange={(e) => setUpdatedApiKey(e.currentTarget.value)} />
        )}
        {connectorAccount?.service === Service.CUSTOM && customConnectors && (
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
          <SecondaryButton variant="default" onClick={props.onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton loading={isSaving} onClick={handleUpdate}>
            Save
          </PrimaryButton>
        </Group>
      </Stack>
    </Modal>
  );
};
