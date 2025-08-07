import { BadgeWithTooltip } from '@/app/components/BadgeWithTooltip';
import { useAgentCredentials } from '@/hooks/use-agent-credentials';
import { CreateAiAgentCredentialDto, UpdateAiAgentCredentialDto } from '@/types/server-entities/agent-credentials';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Checkbox,
  Grid,
  Group,
  Loader,
  Modal,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  useModalsStack,
} from '@mantine/core';
import { useSetState } from '@mantine/hooks';
import { PencilIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';

export const AgentCredentials = () => {
  const { agentCredentials, isLoading, error, createCredentials, updateCredentials, deleteCredentials } =
    useAgentCredentials();
  const modalStack = useModalsStack(['create', 'update', 'confirm-delete']);
  const [createData, setCreateData] = useSetState<CreateAiAgentCredentialDto>({
    service: 'openrouter',
    apiKey: '',
    description: '',
    enabled: true,
  });
  const [updateData, setUpdateData] = useSetState<UpdateAiAgentCredentialDto>({
    apiKey: '',
    description: '',
    enabled: true,
  });
  const [updateId, setUpdateId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const modals = (
    <>
      <Modal {...modalStack.register('create')} title="New credentials" centered>
        <Stack gap="xs">
          <PasswordInput
            label="API Key"
            required
            placeholder="Your OpenRouter API key"
            value={createData.apiKey}
            onChange={(event) => setCreateData({ apiKey: event.target.value })}
          />
          <TextInput
            label="Description"
            placeholder="Optional description"
            value={createData.description}
            onChange={(event) => setCreateData({ description: event.target.value })}
          />
          <Group justify="flex-end">
            <Button variant="outline" onClick={() => modalStack.close('create')}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                createCredentials(createData);
                modalStack.close('create');
                setCreateData({ service: 'openrouter', apiKey: '', description: '' });
              }}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal {...modalStack.register('update')} title="Edit credentials" centered>
        <Stack gap="xs">
          <PasswordInput
            label="API Key"
            required
            placeholder="Your OpenRouter API key"
            value={updateData.apiKey}
            onChange={(event) => setUpdateData({ apiKey: event.target.value })}
          />
          <TextInput
            label="Description"
            placeholder="Optional description"
            value={updateData.description}
            onChange={(event) => setUpdateData({ description: event.target.value })}
          />
          <Checkbox
            label="Enabled"
            checked={updateData.enabled}
            onChange={(event) => setUpdateData({ enabled: event.target.checked })}
          />
          <Group justify="flex-end">
            <Button variant="outline" onClick={() => modalStack.close('update')}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                updateCredentials(updateId!, updateData);
                modalStack.close('update');
                setUpdateId(null);
              }}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
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
                  Enabled
                </Badge>
              ) : (
                <BadgeWithTooltip
                  color="gray"
                  variant="light"
                  size="xs"
                  tooltip="These credentials are not active and will not be used by the agent."
                >
                  Disabled
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
            <Group gap="4px" align="center">
              <ActionIcon
                variant="subtle"
                onClick={() => {
                  setUpdateId(credential.id);
                  setUpdateData({
                    apiKey: credential.apiKey,
                    description: credential.description ?? '',
                    enabled: credential.enabled,
                  });
                  modalStack.open('update');
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
      <Card shadow="sm" padding="sm" radius="md" withBorder>
        <Title order={3} mb="xs">
          Agent Credentials
        </Title>
        {error && (
          <Alert color="red" mb="sm">
            {error}
          </Alert>
        )}
        <Stack gap="xs" mb="sm" mih={200}>
          {list}
        </Stack>
        <Button onClick={() => modalStack.open('create')}>New credential</Button>
      </Card>
    </>
  );
};
