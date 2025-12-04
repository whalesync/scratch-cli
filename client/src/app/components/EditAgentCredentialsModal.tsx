import { Text13Regular } from '@/app/components/base/text';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { PROJECT_NAME } from '@/constants';
import { useAgentCredentials } from '@/hooks/use-agent-credentials';
import { CreateAiAgentCredentialDto, UpdateAiAgentCredentialDto } from '@/types/server-entities/agent-credentials';
import { Alert, Checkbox, ModalProps, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useSetState } from '@mantine/hooks';
import { AgentCredential } from '@spinner/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { ButtonPrimaryLight, ButtonSecondaryOutline } from './base/buttons';
import { ModalWrapper } from './ModalWrapper';

interface EditAgentCredentialsModalProps extends ModalProps {
  credentials: AgentCredential | null;
  onSuccess?: () => void;
}

export const EditAgentCredentialsModal = ({
  credentials,
  onSuccess,
  ...modalProps
}: EditAgentCredentialsModalProps) => {
  const { createCredentials, updateCredentials } = useAgentCredentials(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useSetState<CreateAiAgentCredentialDto>({
    service: 'openrouter',
    apiKey: '',
    description: '',
    default: false,
  });

  useEffect(() => {
    if (!modalProps.opened) {
      return;
    }

    if (credentials) {
      // setup for update
      setFormData({
        service: credentials.service,
        apiKey: '',
        description: credentials.description ?? '',
        default: credentials.default,
      });
    } else {
      // setup for create
      setFormData({
        service: 'openrouter',
        apiKey: '',
        description: '',
        default: false,
      });
    }
  }, [credentials, modalProps.opened, setFormData]);

  const handleSubmit = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);

      if (credentials) {
        const updateDto: UpdateAiAgentCredentialDto = { description: formData.description, default: formData.default };
        await updateCredentials(credentials.id, updateDto);
      } else {
        await createCredentials(formData);
      }
      ScratchpadNotifications.success({
        title: 'Credentials updated',
        message: 'The credentials have been updated',
      });

      onSuccess?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setSaving(false);
    }
  }, [credentials, formData, updateCredentials, createCredentials, onSuccess]);

  return (
    <ModalWrapper
      title={credentials ? 'Edit credentials' : 'New credentials'}
      customProps={{
        footer: (
          <>
            <ButtonSecondaryOutline variant="outline" onClick={() => modalProps.onClose?.()} disabled={saving}>
              Cancel
            </ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleSubmit} disabled={saving}>
              {credentials ? 'Save' : 'Create'}
            </ButtonPrimaryLight>
          </>
        ),
      }}
      {...modalProps}
    >
      <Stack gap="sm">
        {error && (
          <Alert color="red" mb="sm" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Text13Regular c="dimmed">
          {credentials
            ? `Edit the credentials here to enable the ${PROJECT_NAME} agent to use it.`
            : `Register an OpenRouter.ai API key here to enable the ${PROJECT_NAME} agent to use it.`}
        </Text13Regular>
        <PasswordInput
          label="API Key"
          required
          placeholder="Your OpenRouter API key"
          value={credentials ? credentials.label : formData.apiKey}
          onChange={(event) => setFormData({ apiKey: event.target.value })}
          disabled={!!credentials}
        />
        <TextInput
          label="Description"
          placeholder="Optional description"
          value={formData.description}
          onChange={(event) => setFormData({ description: event.target.value })}
          disabled={credentials?.source === 'SYSTEM'}
        />
        <Checkbox
          label="Make default?"
          checked={formData.default}
          onChange={(event) => setFormData({ default: event.target.checked })}
        />
      </Stack>
    </ModalWrapper>
  );
};
