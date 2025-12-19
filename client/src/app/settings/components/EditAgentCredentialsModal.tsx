import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useAgentCredentials } from '@/hooks/use-agent-credentials';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { isExperimentEnabled } from '@/types/server-entities/users';
import { Alert, Checkbox, Divider, ModalProps, NumberInput, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { AgentCredential, CreateAgentCredentialDto, UpdateAgentCredentialDto } from '@spinner/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { ButtonPrimaryLight, ButtonSecondaryOutline } from '../../components/base/buttons';
import { ModalWrapper } from '../../components/ModalWrapper';

interface EditAgentCredentialsModalProps extends ModalProps {
  credentials: AgentCredential | null;
  onSuccess?: () => void;
}

type FormValues = {
  apiKey: string;
  name: string;
  isDefaultProvider?: boolean;
  tokenUsageWarningLimit?: number | null;
};

export const EditAgentCredentialsModal = ({
  credentials,
  onSuccess,
  ...modalProps
}: EditAgentCredentialsModalProps) => {
  const { user } = useScratchPadUser();
  const { createCredentials, updateCredentials } = useAgentCredentials(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    initialValues: {
      apiKey: '',
      name: '',
      isDefaultProvider: false,
    },
    validate: {
      apiKey: (value) => (value.trim().length > 0 ? null : 'API Key is required'),
      name: (value) => (value.trim().length > 0 ? null : 'Name is required'),
    },
  });

  useEffect(() => {
    if (modalProps.opened) {
      form.reset();
      form.setValues({
        apiKey: credentials?.label ?? '',
        name: credentials?.name ?? '',
        isDefaultProvider: credentials?.default ?? false,
        tokenUsageWarningLimit: credentials?.tokenUsageWarningLimit ?? undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doesn't work for form values.
  }, [modalProps.opened, credentials]);

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      try {
        setSaving(true);
        setError(null);

        if (credentials) {
          const dto = new UpdateAgentCredentialDto();
          dto.name = credentials.source === 'USER' ? values.name : undefined;
          dto.default = values.isDefaultProvider;
          dto.tokenUsageWarningLimit = values.tokenUsageWarningLimit;
          await updateCredentials(credentials.id, dto);
        } else {
          const dto = new CreateAgentCredentialDto();
          dto.service = 'openrouter';
          dto.apiKey = values.apiKey;
          dto.name = values.name;
          dto.default = values.isDefaultProvider;
          dto.tokenUsageWarningLimit = values.tokenUsageWarningLimit;
          await createCredentials(dto);
        }
        ScratchpadNotifications.success({
          title: 'Credentials updated',
          message: 'The credentials have been updated',
        });

        onSuccess?.();
      } catch (error) {
        console.error('Error updating credentials:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setSaving(false);
      }
    },
    [credentials, updateCredentials, createCredentials, onSuccess],
  );

  const tokenUsageWarningLimit = form.getValues().tokenUsageWarningLimit;
  const isTokenUsageWarningChecked = typeof tokenUsageWarningLimit === 'number' && tokenUsageWarningLimit > 0;

  return (
    <ModalWrapper
      title={`${credentials ? 'Edit' : 'Add'} OpenRouter API Key`}
      customProps={{
        footer: (
          <>
            <ButtonSecondaryOutline variant="outline" onClick={() => modalProps.onClose?.()} disabled={saving}>
              Cancel
            </ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={() => form.onSubmit(handleSubmit)()} disabled={saving}>
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
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="16px">
          <TextInput
            size="xs"
            label="Name"
            required
            disabled={credentials?.source === 'SYSTEM'}
            {...form.getInputProps('name')}
          />
          <PasswordInput
            size="xs"
            label="API Key"
            required
            {...form.getInputProps('apiKey')}
            disabled={!!credentials}
          />
          {isExperimentEnabled('ENABLE_TOKEN_LIMIT_WARNINGS', user) && (
            <>
              <Divider label="Settings" labelPosition="left" />
              <Checkbox
                label="Token usage warning"
                description="Get notified if a chat session exceeds the specified token limit."
                checked={isTokenUsageWarningChecked}
                onChange={(event) => {
                  if (event.target.checked) {
                    form.setFieldValue('tokenUsageWarningLimit', 1000);
                  } else {
                    form.setFieldValue('tokenUsageWarningLimit', null);
                  }
                }}
              />
              <NumberInput ml="28px" size="xs" min={0} hideControls {...form.getInputProps('tokenUsageWarningLimit')} />
            </>
          )}

          <Checkbox
            label="Default model provider default"
            description="Use this model provider as default in new workbooks."
            {...form.getInputProps('isDefaultProvider', { type: 'checkbox' })}
          />
        </Stack>
      </form>
    </ModalWrapper>
  );
};
