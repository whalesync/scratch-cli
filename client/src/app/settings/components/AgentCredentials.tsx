import { BadgeWithTooltip } from '@/app/components/BadgeWithTooltip';
import { PrimaryButton } from '@/app/components/base/buttons';
import { TextRegularSm, TextTitleLg } from '@/app/components/base/text';
import { EditAgentCredentialsModal } from '@/app/components/EditAgentCredentialsModal';
import { useAgentCredentials } from '@/hooks/use-agent-credentials';
import { AiAgentCredential } from '@/types/server-entities/agent-credentials';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Grid,
  Group,
  Loader,
  Modal,
  PasswordInput,
  Stack,
  Text,
  useModalsStack,
} from '@mantine/core';
import { PencilIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';

export const AgentCredentials = () => {
  const { agentCredentials, isLoading, error, deleteCredentials } = useAgentCredentials();
  const modalStack = useModalsStack(['edit', 'confirm-delete']);
  const [activeCredential, setActiveCredential] = useState<AiAgentCredential | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const modals = (
    <>
      <EditAgentCredentialsModal
        {...modalStack.register('edit')}
        credentials={activeCredential}
        onSuccess={() => {
          setActiveCredential(null);
          modalStack.close('edit');
        }}
      />

      <Modal {...modalStack.register('confirm-delete')} title="Confirm delete" centered>
        <Stack gap="sm">
          <Text>Are you sure you want to delete these credentials?</Text>
          <Group justify="flex-end">
            <Button onClick={() => modalStack.close('confirm-delete')}>Cancel</Button>
            <Button
              onClick={() => {
                deleteCredentials(deleteId!);
                modalStack.close('confirm-delete');
                setDeleteId(null);
              }}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );

  const getServiceIcon = (serviceName: string) => {
    switch (serviceName) {
      case 'openrouter':
        return 'OpenRouter';
      case 'anthropic':
        return 'Anthropic';
      case 'gemini':
        return 'Gemini';
      default:
        return serviceName;
    }
  };

  const list = isLoading ? (
    <Center mih={200}>
      <Loader />
      <Text>Loading...</Text>
    </Center>
  ) : agentCredentials && agentCredentials.length > 0 ? (
    <>
      {agentCredentials?.map((credential) => (
        <Grid key={credential.id} align="flex-start">
          <Grid.Col span={3}>
            <Group gap="xs">
              <Text fw={500}>{getServiceIcon(credential.service)}</Text>
              {credential.enabled ? (
                <Badge color="green" variant="light" size="xs">
                  Active
                </Badge>
              ) : (
                <BadgeWithTooltip
                  color="gray"
                  variant="light"
                  size="xs"
                  tooltip="These credentials are not active and will not be used by the agent."
                >
                  Inactive
                </BadgeWithTooltip>
              )}
            </Group>
          </Grid.Col>
          <Grid.Col span={7}>
            <Stack gap="xs">
              <PasswordInput
                variant="unstyled"
                value={credential.apiKey}
                readOnly
                description={credential.description}
                inputWrapperOrder={['input', 'label', 'description', 'error']}
              />
            </Stack>
          </Grid.Col>
          <Grid.Col span={2}>
            <Group gap="4px" justify="flex-end" align="flex-end">
              <ActionIcon
                variant="subtle"
                onClick={() => {
                  setActiveCredential(credential);
                  modalStack.open('edit');
                }}
              >
                <PencilIcon />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                onClick={() => {
                  setDeleteId(credential.id);
                  modalStack.open('confirm-delete');
                }}
              >
                <TrashIcon />
              </ActionIcon>
            </Group>
          </Grid.Col>
        </Grid>
      ))}
    </>
  ) : (
    <Center mih={200}>
      <Text>No credentials found</Text>
    </Center>
  );

  return (
    <>
      {modals}
      <Card shadow="sm" padding="sm" radius="md" withBorder miw={700}>
        <TextTitleLg mb="xs">Agent Credentials</TextTitleLg>
        {error && (
          <Alert color="red" mb="sm">
            {error}
          </Alert>
        )}
        <Stack gap="xs" mb="sm" mih={100}>
          <TextRegularSm c="dimmed">Add your OpenRouterAPI keys here to enable the agent to use them.</TextRegularSm>
          {list}
        </Stack>
        <Group justify="flex-end">
          <PrimaryButton
            size="xs"
            w="fit-content"
            onClick={() => {
              setActiveCredential(null);
              modalStack.open('edit');
            }}
            leftSection={<PlusIcon />}
          >
            New credential
          </PrimaryButton>
        </Group>
      </Card>
    </>
  );
};
