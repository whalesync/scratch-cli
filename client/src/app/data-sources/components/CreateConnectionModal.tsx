import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { ModalWrapper } from '@/app/components/ModalWrapper';
import { useConnectorAccounts } from '@/hooks/use-connector-account';
import { useSubscription } from '@/hooks/use-subscription';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { ScratchpadApiError } from '@/lib/api/error';
import { getOauthLabel, getOauthPrivateLabel, serviceName } from '@/service-naming-conventions';
import { OAuthService } from '@/types/oauth';
import { Service } from '@/types/server-entities/connector-accounts';
import { initiateOAuth } from '@/utils/oauth';
import {
  Alert,
  Group,
  Text as MantineText,
  ModalProps,
  Radio,
  SimpleGrid,
  Stack,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { Check } from 'lucide-react';
import { useState } from 'react';

type AuthMethod = 'user_provided_params' | 'oauth' | 'oauth_custom';

export type CreateConnectionModalProps = ModalProps & {
  returnUrl?: string;
};

export const CreateConnectionModal = (props: CreateConnectionModalProps) => {
  const { returnUrl, ...modalProps } = props;
  const [error, setError] = useState<string | null>(null);
  const [newDisplayName, setNewDisplayName] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newService, setNewService] = useState<Service | null>(null);
  const [newModifier, setNewModifier] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('oauth');

  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [customClientId, setCustomClientId] = useState('');
  const [customClientSecret, setCustomClientSecret] = useState('');
  const [showOAuthCustom, setShowOAuthCustom] = useState(false);
  const { user } = useScratchPadUser();
  const { canCreateDataSource } = useSubscription();

  const { createConnectorAccount } = useConnectorAccounts();

  const getDefaultAuthMethod = (service: Service): AuthMethod => {
    // Services that support OAuth
    const oauthSupportedServices = [Service.NOTION, Service.YOUTUBE, Service.WEBFLOW, Service.WIX_BLOG];

    // Services that use generic parameters
    const genericParametersSupportedServices = [Service.NOTION, Service.AIRTABLE, Service.WORDPRESS, Service.CSV];
    if (oauthSupportedServices.includes(service)) {
      return 'oauth';
    } else if (genericParametersSupportedServices.includes(service)) {
      return 'user_provided_params';
    } else {
      return 'oauth'; // Default fallback
    }
  };

  const getSupportedAuthMethods = (service: Service): AuthMethod[] => {
    const oauthSupportedServices = [Service.NOTION, Service.YOUTUBE, Service.WEBFLOW, Service.WIX_BLOG];
    const userProvidedParamsSupportedServices = [Service.NOTION, Service.AIRTABLE, Service.WORDPRESS];
    const methods: AuthMethod[] = [];
    if (oauthSupportedServices.includes(service)) {
      methods.push('oauth');
      // Enable Private OAuth only for YouTube (generic-ready for future services)
      if (service === Service.YOUTUBE) {
        methods.push('oauth_custom');
      }
    }
    if (userProvidedParamsSupportedServices.includes(service)) {
      methods.push('user_provided_params');
    }
    return methods;
  };

  const handleSelectNewService = (service: Service) => {
    setNewService(service);
    setNewDisplayName(serviceName(service));
    setAuthMethod(getDefaultAuthMethod(service));
    setCustomClientId('');
    setCustomClientSecret('');
  };

  const handleClearForm = () => {
    setNewApiKey('');
    setUsername('');
    setPassword('');
    setEndpoint('');
    setNewService(null);
    setNewModifier(null);
    setNewDisplayName(null);
    setAuthMethod('oauth'); // Reset to default
    setError(null);
  };

  const handleOAuthInitiate = async () => {
    if (!newService) {
      setError('Please select a service first.');
      return;
    }

    setIsOAuthLoading(true);
    try {
      const isCustom = authMethod === 'oauth_custom';
      const connectionName = newDisplayName ?? undefined;
      const returnPage = returnUrl ?? window.location.pathname;
      console.debug('connectionName', connectionName);
      await initiateOAuth(newService as OAuthService, {
        // (http|https)://<host, e.g. test.scratch.md>
        redirectPrefix: `${window.location.protocol}//${window.location.host}`,
        connectionMethod: isCustom ? 'OAUTH_CUSTOM' : 'OAUTH_SYSTEM',
        customClientId: isCustom ? customClientId : undefined,
        customClientSecret: isCustom ? customClientSecret : undefined,
        connectionName: connectionName,
        returnPage: returnPage,
      });
      // The initiateOAuth function will redirect the user, so we don't need to do anything else here
    } catch (error) {
      console.error('OAuth initiation failed:', error);
      setError('Failed to start OAuth flow. Please try again.');
      setIsOAuthLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newService) {
      setError('Service is required.');
      return;
    }
    if (!canCreateDataSource(newService)) {
      setError(
        `You have reached the limit for ${serviceName(newService)} connections. Please upgrade your plan to add more.`,
      );
      return;
    }
    if (
      authMethod === 'user_provided_params' &&
      newService !== Service.CSV &&
      newService !== Service.WORDPRESS &&
      !newApiKey
    ) {
      setError('API key is required for this service.');
      return;
    }
    if (
      authMethod === 'user_provided_params' &&
      newService === Service.WORDPRESS &&
      !username &&
      !password &&
      !endpoint
    ) {
      setError('Username, password, and endpoint are required for this service.');
      return;
    }
    try {
      setIsCreating(true);
      // For OAuth, the connection will be created in the callback page
      if (authMethod === 'oauth' || authMethod === 'oauth_custom') {
        await handleOAuthInitiate();
        return;
      }

      await createConnectorAccount({
        service: newService,
        userProvidedParams:
          newService === Service.CSV
            ? { apiKey: newApiKey }
            : newService === Service.WORDPRESS
              ? { username, password, endpoint }
              : { apiKey: newApiKey },
        modifier: newModifier || undefined,
        displayName: newDisplayName || undefined,
      });
      handleClearForm();
      props.onClose?.();
    } catch (error) {
      console.error('Failed to create connection:', error);
      if (error instanceof ScratchpadApiError) {
        setError(error.message);
      } else {
        setError('Failed to create connection. Please try again.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const availableServices = (user?.experimentalFlags?.CONNECTOR_LIST ?? []) as Service[];

  return (
    <ModalWrapper
      title="Create Connection"
      customProps={{
        footer: (
          <>
            <ButtonSecondaryOutline onClick={props.onClose}>Cancel</ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleCreate} loading={isOAuthLoading || isCreating}>
              {authMethod === 'oauth' && newService ? 'Connect with ' + serviceName(newService) : 'Create'}
            </ButtonPrimaryLight>
          </>
        ),
      }}
      {...modalProps}
      onExitTransitionEnd={() => {
        // clear the form when the modal is closed
        handleClearForm();
      }}
    >
      <Stack>
        {error && <Alert color="red">{error}</Alert>}
        <MantineText size="sm" fw={500} mb={4}>
          App
        </MantineText>
        <SimpleGrid cols={2} spacing="xs" mb="md">
          {availableServices.map((service) => {
            const isSelected = newService === service;
            return (
              <UnstyledButton
                key={service}
                onClick={() => handleSelectNewService(service)}
                style={{
                  border: `1px solid ${isSelected ? 'var(--mantine-color-teal-4)' : 'var(--mantine-color-gray-3)'}`,
                  padding: '6px 8px',
                  backgroundColor: isSelected ? 'var(--mantine-color-teal-0)' : 'transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <ConnectorIcon connector={service} size={20} />
                    <MantineText size="sm" fw={500}>
                      {serviceName(service)}
                    </MantineText>
                  </Group>
                  {isSelected && <Check style={{ width: 12, height: 12, color: 'var(--mantine-color-teal-6)' }} />}
                </Group>
              </UnstyledButton>
            );
          })}
        </SimpleGrid>
        <TextInput
          label="Name"
          placeholder="Enter a name for your connection"
          value={newDisplayName ?? ''}
          required
          onChange={(e) => setNewDisplayName(e.currentTarget.value)}
        />

        {/* Authentication Method */}
        <Stack
          style={{
            minHeight: 150, // So that the UI doesn't jump too much
          }}
        >
          {newService && getSupportedAuthMethods(newService).length > 1 && (
            <Radio.Group
              label={
                <span
                  onClick={(e: React.MouseEvent) => {
                    if (e.ctrlKey || e.metaKey) {
                      e.preventDefault();
                      setShowOAuthCustom(!showOAuthCustom);
                    }
                  }}
                >
                  Authentication Method
                </span>
              }
              value={authMethod}
              onChange={(value) => setAuthMethod(value as AuthMethod)}
            >
              <Group gap="xs" mt="xs">
                {getSupportedAuthMethods(newService).includes('oauth') && (
                  <Radio value="oauth" label={getOauthLabel(newService)} />
                )}
                {getSupportedAuthMethods(newService).includes('user_provided_params') && (
                  <Radio value="user_provided_params" label="API Key" />
                )}
                {newService === Service.YOUTUBE && showOAuthCustom && (
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
          {authMethod === 'user_provided_params' && newService === Service.WORDPRESS && (
            <Stack>
              <Group grow>
                <TextInput
                  label="User email"
                  placeholder="Enter your user email here"
                  value={username}
                  onChange={(e) => setUsername(e.currentTarget.value)}
                />
                <TextInput
                  label="Application password"
                  placeholder="Enter your application password here"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  type="password"
                />
              </Group>
              <TextInput
                label="WordPress URL"
                placeholder="Enter the address of your WordPress site here"
                value={endpoint}
                onChange={(e) => setEndpoint(e.currentTarget.value)}
              />
            </Stack>
          )}
          {newService === Service.CSV && (
            <Alert color="blue" title="CSV Connection">
              CSV connections allow you to work with CSV files uploaded to your account. No API key is required.
            </Alert>
          )}
          {newService &&
            newService !== Service.CSV &&
            newService !== Service.WORDPRESS &&
            getSupportedAuthMethods(newService).includes('user_provided_params') &&
            authMethod === 'user_provided_params' && (
              <TextInput
                label="API Key"
                placeholder="Enter API Key"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.currentTarget.value)}
              />
            )}
        </Stack>
      </Stack>
    </ModalWrapper>
  );
};
