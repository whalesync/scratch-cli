import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { useConnectorAccounts } from '@/hooks/use-connector-account';
import { useCustomConnectors } from '@/hooks/use-custom-connector';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { getLogo, getOauthLabel, getOauthPrivateLabel, serviceName } from '@/service-naming-conventions';
import { OAuthService } from '@/types/oauth';
import { INTERNAL_SERVICES, LIVE_SERVICES, Service } from '@/types/server-entities/connector-accounts';
import { initiateOAuth } from '@/utils/oauth';
import { Alert, Group, Modal, ModalProps, Radio, Select, Stack, TextInput } from '@mantine/core';
import Image from 'next/image';
import { useState } from 'react';

type AuthMethod = 'api_key' | 'oauth' | 'oauth_custom';

export const CreateConnectionModal = (props: ModalProps) => {
  const [newDisplayName, setNewDisplayName] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState('');
  const [newService, setNewService] = useState<Service | null>(null);
  const [newModifier, setNewModifier] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('oauth');
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [customClientId, setCustomClientId] = useState('');
  const [customClientSecret, setCustomClientSecret] = useState('');
  const { isAdmin } = useScratchPadUser();

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
      // Enable Private OAuth only for YouTube (generic-ready for future services)
      if (service === Service.YOUTUBE) {
        methods.push('oauth_custom');
      }
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
      const isCustom = authMethod === 'oauth_custom';
      const connectionName = newDisplayName ?? undefined;
      console.log('connectionName', connectionName);
      await initiateOAuth(newService as OAuthService, {
        connectionMethod: isCustom ? 'OAUTH_CUSTOM' : 'OAUTH_SYSTEM',
        customClientId: isCustom ? customClientId : undefined,
        customClientSecret: isCustom ? customClientSecret : undefined,
        connectionName: connectionName,
      });
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
    if (authMethod === 'oauth' || authMethod === 'oauth_custom') {
      await handleOAuthInitiate();
      return;
    }

    await createConnectorAccount({
      service: newService,
      apiKey: newService === Service.CSV ? '' : newApiKey,
      modifier: newModifier || undefined,
      displayName: newDisplayName || undefined,
    });
    setNewApiKey('');
    setNewService(null);
    setNewModifier(null);
    setNewDisplayName(null);
    setAuthMethod('oauth'); // Reset to default
    // if (newAccount && newAccount.id) {
    //   await handleTest(newAccount.id);
    // }
    props.onClose?.();
  };

  // TODO (Chris) - this should be powered by the server via a FeatureFlag
  const availableServices = isAdmin ? [...LIVE_SERVICES, ...INTERNAL_SERVICES] : LIVE_SERVICES;

  return (
    <Modal title="Create Connection" size="lg" centered {...props}>
      <Stack>
        <Select
          label="Service"
          placeholder="Pick a service"
          data={availableServices.map((service) => {
            const isInternalOnly = INTERNAL_SERVICES.includes(service);
            return {
              value: service,
              label: `${serviceName(service)} ${isInternalOnly ? '(Internal Only)' : ''}`,
            };
          })}
          value={newService}
          onChange={(value) => {
            setNewService(value as Service);
            setNewDisplayName(serviceName(value as Service));
            // Set default auth method based on service capabilities
            setAuthMethod(getDefaultAuthMethod(value as Service));
            setCustomClientId('');
            setCustomClientSecret('');
          }}
          renderOption={({ option }) => {
            const service = option.value as Service;
            const iconPath = getLogo(service);
            return (
              <Group gap="sm">
                <Image src={iconPath} alt={`${serviceName(service)} icon`} width={22} height={22} />
                <span>{option.label}</span>
              </Group>
            );
          }}
        />
        <TextInput
          label="Name"
          placeholder="Enter a name for your connection"
          value={newDisplayName ?? ''}
          required
          onChange={(e) => setNewDisplayName(e.currentTarget.value)}
        />

        {newService && getSupportedAuthMethods(newService).length > 1 && (
          <Radio.Group
            label="Authentication Method"
            value={authMethod}
            onChange={(value) => setAuthMethod(value as AuthMethod)}
          >
            <Group gap="xs" mt="xs">
              {getSupportedAuthMethods(newService).includes('oauth') && (
                <Radio value="oauth" label={getOauthLabel(newService)} />
              )}
              {getSupportedAuthMethods(newService).includes('api_key') && <Radio value="api_key" label="API Key" />}
              {newService === Service.YOUTUBE && (
                <Radio value="oauth_custom" label={getOauthPrivateLabel(newService)} />
              )}
            </Group>
          </Radio.Group>
        )}
        {/* Private OAuth credentials (YouTube only for now) */}
        {authMethod === 'oauth_custom' && (
          <>
            <Alert color="blue" title="Private OAuth">
              How to set up a private OAuth connection{' '}
              <a href="https://www.google.com" target="_blank" rel="noreferrer">
                here
              </a>
              .
            </Alert>
            <TextInput
              label="OAuth Client ID"
              placeholder="Enter your app's client ID"
              value={customClientId}
              onChange={(e) => setCustomClientId(e.currentTarget.value)}
            />
            <TextInput
              label="OAuth Client Secret"
              placeholder="Enter your app's client secret"
              value={customClientSecret}
              onChange={(e) => setCustomClientSecret(e.currentTarget.value)}
              type="password"
            />
          </>
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
            {authMethod === 'oauth' && newService ? 'Connect with ' + serviceName(newService) : 'Create'}
          </PrimaryButton>
        </Group>
      </Stack>
    </Modal>
  );
};
