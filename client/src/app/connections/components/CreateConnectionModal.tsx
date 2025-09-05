import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { useConnectorAccounts } from '@/hooks/use-connector-account';
import { useCustomConnectors } from '@/hooks/use-custom-connector';
import { Service } from '@/types/server-entities/connector-accounts';
import { initiateOAuth } from '@/utils/oauth';
import { Alert, Group, Modal, ModalProps, Radio, Select, Stack, TextInput } from '@mantine/core';
import { useState } from 'react';

type AuthMethod = 'api_key' | 'oauth';

export const CreateConnectionModal = (props: ModalProps) => {
  const [newApiKey, setNewApiKey] = useState('');
  const [newService, setNewService] = useState<Service | null>(null);
  const [newModifier, setNewModifier] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('oauth');
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);

  const { createConnectorAccount } = useConnectorAccounts();
  const { data: customConnectors } = useCustomConnectors();

  const getDefaultAuthMethod = (service: Service): AuthMethod => {
    // Services that support OAuth
    const oauthSupportedServices = [Service.NOTION, Service.YOUTUBE];
    // Services that support API keys
    const apiKeySupportedServices = [Service.NOTION, Service.AIRTABLE, Service.CUSTOM];

    if (oauthSupportedServices.includes(service)) {
      return 'oauth';
    } else if (apiKeySupportedServices.includes(service)) {
      return 'api_key';
    } else {
      return 'api_key'; // Default fallback
    }
  };

  const getSupportedAuthMethods = (service: Service): AuthMethod[] => {
    const oauthSupportedServices = [Service.NOTION, Service.YOUTUBE];
    const apiKeySupportedServices = [Service.NOTION, Service.AIRTABLE, Service.CUSTOM];

    const methods: AuthMethod[] = [];
    if (oauthSupportedServices.includes(service)) {
      methods.push('oauth');
    }
    if (apiKeySupportedServices.includes(service)) {
      methods.push('api_key');
    }
    return methods;
  };

  const handleOAuthInitiate = async () => {
    if (!newService) {
      alert('Please select a service first.');
      return;
    }

    setIsOAuthLoading(true);
    try {
      await initiateOAuth(newService.toLowerCase() as 'notion' | 'youtube');
      // The initiateOAuth function will redirect the user, so we don't need to do anything else here
    } catch (error) {
      console.error('OAuth initiation failed:', error);
      alert('Failed to start OAuth flow. Please try again.');
      setIsOAuthLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newService) {
      alert('Service is required.');
      return;
    }
    if (authMethod === 'api_key' && newService !== Service.CSV && !newApiKey) {
      alert('API key is required for this service.');
      return;
    }

    // For OAuth, the connection will be created in the callback page
    if (authMethod === 'oauth') {
      await handleOAuthInitiate();
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
    setAuthMethod('oauth'); // Reset to default
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
          onChange={(value) => {
            setNewService(value as Service);
            // Set default auth method based on service capabilities
            setAuthMethod(getDefaultAuthMethod(value as Service));
          }}
        />

        {newService && getSupportedAuthMethods(newService).length > 1 && (
          <Radio.Group
            label="Authentication Method"
            value={authMethod}
            onChange={(value) => setAuthMethod(value as AuthMethod)}
          >
            <Group gap="xs" mt="xs">
              {getSupportedAuthMethods(newService).includes('oauth') && (
                <Radio value="oauth" label="OAuth (Recommended)" />
              )}
              {getSupportedAuthMethods(newService).includes('api_key') && <Radio value="api_key" label="API Key" />}
            </Group>
          </Radio.Group>
        )}
        {newService === Service.CSV && (
          <Alert color="blue" title="CSV Connection">
            CSV connections allow you to work with CSV files uploaded to your account. No API key is required.
          </Alert>
        )}

        {newService &&
          newService !== Service.CSV &&
          getSupportedAuthMethods(newService).includes('api_key') &&
          authMethod === 'api_key' && (
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
          <PrimaryButton onClick={handleCreate} loading={isOAuthLoading}>
            {newService === Service.NOTION && authMethod === 'oauth'
              ? 'Connect with Notion'
              : newService === Service.YOUTUBE && authMethod === 'oauth'
                ? 'Connect with YouTube'
                : 'Create'}
          </PrimaryButton>
        </Group>
      </Stack>
    </Modal>
  );
};
