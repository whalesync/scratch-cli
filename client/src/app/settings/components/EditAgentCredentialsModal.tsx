import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useAgentCredentials } from '@/hooks/use-agent-credentials';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { isExperimentEnabled } from '@/types/server-entities/users';
import { Alert, Checkbox, Divider, ModalProps, NumberInput, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useSetState } from '@mantine/hooks';
import { AgentCredential, CreateAgentCredentialDto, UpdateAgentCredentialDto } from '@spinner/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { ButtonPrimaryLight, ButtonSecondaryOutline } from '../../components/base/buttons';
import { ModalWrapper } from '../../components/ModalWrapper';

interface EditAgentCredentialsModalProps extends ModalProps {
  credentials: AgentCredential | null;
  onSuccess?: () => void;
}

export const EditAgentCredentialsModal = ({
  credentials,
  onSuccess,
  ...modalProps
}: EditAgentCredentialsModalProps) => {
  const { user } = useScratchPadUser();
  const { createCredentials, updateCredentials } = useAgentCredentials(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useSetState<CreateAgentCredentialDto>({
    service: 'openrouter',
    apiKey: '',
    name: '',
    default: false,
    tokenUsageWarningLimit: undefined,
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
        name: credentials.name ?? '',
        default: credentials.default,
        tokenUsageWarningLimit: credentials.tokenUsageWarningLimit ?? undefined,
      });
    } else {
      // setup for create
      setFormData({
        service: 'openrouter',
        apiKey: '',
        name: '',
        default: false,
        tokenUsageWarningLimit: undefined,
      });
    }
  }, [credentials, modalProps.opened, setFormData]);

  const handleSubmit = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);

      if (credentials) {
        const updateDto: UpdateAgentCredentialDto = {
          name: credentials.source === 'USER' ? formData.name : undefined,
          default: formData.default,
          tokenUsageWarningLimit: formData.tokenUsageWarningLimit,
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
    <ModalWrapper
      title={`${credentials ? 'Edit' : 'Add'} OpenRouter API Key`}
      customProps={{
        footer: (
          <>
            <ButtonSecondaryOutline variant="outline" onClick={() => modalProps.onClose?.()} disabled={saving}>
              Cancel
            </ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleSubmit} disabled={saving}>
              {credentials ? 'Save' : 'Add API Key'}
            </ButtonPrimaryLight>
          </>
        ),
      }}
      {...modalProps}
    >
      {error && (
        <Alert color="red" mb="sm" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Stack gap="16px">
        <TextInput
          size="xs"
          label="Name"
          required
          value={formData.name}
          onChange={(event) => setFormData({ name: event.target.value })}
          disabled={credentials?.source === 'SYSTEM'}
        />
        <PasswordInput
          size="xs"
          label="API Key"
          required
          value={credentials ? credentials.label : formData.apiKey}
          onChange={(event) => setFormData({ apiKey: event.target.value })}
          disabled={!!credentials}
        />
        {isExperimentEnabled('ENABLE_TOKEN_LIMIT_WARNINGS', user) && (
          <>
            <Divider label="Settings" labelPosition="left" />
            <Checkbox
              label="Token usage warning"
              description="Get notified if a chat session exceeds the specified token limit."
              checked={formData.tokenUsageWarningLimit !== undefined && formData.tokenUsageWarningLimit > 0}
              onChange={(event) => {
                if (event.target.checked) {
                  setFormData({ tokenUsageWarningLimit: 1000 });
                } else {
                  setFormData({ tokenUsageWarningLimit: undefined });
                }
              }}
            />
            <NumberInput
              ml="28px"
              size="xs"
              min={0}
              hideControls
              value={formData.tokenUsageWarningLimit ?? ''}
              onChange={(value) => {
                if (typeof value === 'number') {
                  setFormData({ tokenUsageWarningLimit: value });
                } else {
                  setFormData({ tokenUsageWarningLimit: undefined });
                }
              }}
            />
          </>
        )}

        <Checkbox
          label="Default model provider default"
          description="Use this model provider as default in new workbooks."
          checked={formData.default}
          onChange={(event) => setFormData({ default: event.target.checked })}
        />
      </Stack>
    </ModalWrapper>
  );
};
