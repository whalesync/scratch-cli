import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { TextRegularSm } from '@/app/components/base/text';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { PROJECT_NAME } from '@/constants';
import { useAgentCredentials } from '@/hooks/use-agent-credentials';
import {
  AiAgentCredential,
  CreateAiAgentCredentialDto,
  UpdateAiAgentCredentialDto,
} from '@/types/server-entities/agent-credentials';
import { Alert, Checkbox, Group, Modal, ModalProps, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useSetState } from '@mantine/hooks';
import { useCallback, useEffect, useState } from 'react';

interface EditAgentCredentialsModalProps extends ModalProps {
  credentials: AiAgentCredential | null;
  onSuccess?: () => void;
}

export const EditAgentCredentialsModal = ({
  credentials,
  onSuccess,
  ...modalProps
}: EditAgentCredentialsModalProps) => {
  const { createCredentials, updateCredentials } = useAgentCredentials();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useSetState<CreateAiAgentCredentialDto>({
    service: 'openrouter',
    apiKey: '',
    description: '',
    enabled: true,
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
        enabled: credentials.enabled,
      });
    } else {
      // setup for create
      setFormData({
        service: 'openrouter',
        apiKey: '',
        description: '',
        enabled: true,
      });
    }
  }, [credentials, modalProps.opened, setFormData]);

  const handleSubmit = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);

      if (credentials) {
        const updateDto: UpdateAiAgentCredentialDto =
          credentials.source === 'SYSTEM'
            ? {
                enabled: formData.enabled,
              }
            : {
                description: formData.description,
                enabled: formData.enabled,
              };
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
    <Modal {...modalProps} title={credentials ? 'Edit credentials' : 'New credentials'} centered size="lg">
      <Stack gap="sm">
        {error && (
          <Alert color="red" mb="sm" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <TextRegularSm c="dimmed">
          {credentials
            ? `Edit the credentials here to enable the ${PROJECT_NAME} agent to use it.`
            : `Register an OpenRouter.ai API key here to enable the ${PROJECT_NAME} agent to use it.`}
        </TextRegularSm>
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
          label="Active"
          checked={formData.enabled}
          onChange={(event) => setFormData({ enabled: event.target.checked })}
        />
        <Group justify="flex-end">
          <SecondaryButton variant="outline" onClick={() => modalProps.onClose?.()} disabled={saving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={saving}>
            {credentials ? 'Save' : 'Create'}
          </PrimaryButton>
        </Group>
      </Stack>
    </Modal>
  );
};
