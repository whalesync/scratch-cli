import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { ModalWrapper } from '@/app/components/ModalWrapper';
import { useConnectorAccounts } from '@/hooks/use-connector-account';
import { ConnectorAccount } from '@/types/server-entities/connector-accounts';
import { Alert, ModalProps, Stack, TextInput } from '@mantine/core';
import { AuthType, Service } from '@spinner/shared-types';
import { useEffect, useState } from 'react';

interface UpdateConnectionModalProps extends ModalProps {
  connectorAccount: ConnectorAccount | null;
}

export const UpdateConnectionModal = (props: UpdateConnectionModalProps) => {
  const { connectorAccount, ...modalProps } = props;
  const [updatedName, setUpdatedName] = useState('');
  const [updatedApiKey, setUpdatedApiKey] = useState('');
  const [updatedUsername, setUpdatedUsername] = useState('');
  const [updatedPassword, setUpdatedPassword] = useState('');
  const [updatedEndpoint, setUpdatedEndpoint] = useState('');
  const [updatedModifier, setUpdatedModifier] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { updateConnectorAccount } = useConnectorAccounts();

  useEffect(() => {
    if (connectorAccount) {
      setUpdatedName(connectorAccount.displayName);
      setUpdatedModifier(connectorAccount.modifier);
    }
  }, [connectorAccount]);

  const handleUpdate = async () => {
    if (!connectorAccount) return;
    setIsSaving(true);
    try {
      // Build userProvidedParams only if user has entered values
      let userProvidedParams: Record<string, string> | undefined = undefined;

      if (connectorAccount.service === Service.CSV) {
        // CSV doesn't need params
        userProvidedParams = undefined;
      } else if (connectorAccount.service === Service.WORDPRESS) {
        // Only include WordPress params if at least one field is filled
        if (updatedUsername || updatedPassword || updatedEndpoint) {
          userProvidedParams = { username: updatedUsername, password: updatedPassword, endpoint: updatedEndpoint };
        }
      } else {
        // Only include API key if it's been entered
        if (updatedApiKey) {
          userProvidedParams = { apiKey: updatedApiKey };
        }
      }

      await updateConnectorAccount(connectorAccount.id, {
        displayName: updatedName,
        ...(userProvidedParams && { userProvidedParams }),
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
    <ModalWrapper
      customProps={{
        footer: (
          <>
            <ButtonSecondaryOutline variant="default" onClick={props.onClose}>
              Cancel
            </ButtonSecondaryOutline>
            <ButtonPrimaryLight loading={isSaving} onClick={handleUpdate}>
              Save
            </ButtonPrimaryLight>
          </>
        ),
      }}
      title="Edit Data Source"
      centered
      {...modalProps}
    >
      <Stack>
        {error && <Alert color="red">{error}</Alert>}
        <TextInput label="Display Name" value={updatedName} onChange={(e) => setUpdatedName(e.currentTarget.value)} />
        {connectorAccount?.authType === AuthType.USER_PROVIDED_PARAMS &&
          connectorAccount?.service !== Service.CSV &&
          connectorAccount?.service !== Service.WORDPRESS && (
            <TextInput
              label="API Key"
              value={updatedApiKey}
              placeholder="Enter your new API key, secret or token"
              onChange={(e) => setUpdatedApiKey(e.currentTarget.value)}
            />
          )}
        {connectorAccount?.authType === AuthType.USER_PROVIDED_PARAMS &&
          connectorAccount?.service === Service.WORDPRESS && (
            <>
              <TextInput
                label="Username"
                value={updatedUsername}
                onChange={(e) => setUpdatedUsername(e.currentTarget.value)}
              />
              <TextInput
                label="Password"
                value={updatedPassword}
                onChange={(e) => setUpdatedPassword(e.currentTarget.value)}
              />
              <TextInput
                label="Endpoint"
                value={updatedEndpoint}
                onChange={(e) => setUpdatedEndpoint(e.currentTarget.value)}
              />
            </>
          )}
      </Stack>
    </ModalWrapper>
  );
};
