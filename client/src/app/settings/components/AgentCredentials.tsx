import { BadgeWithTooltip } from '@/app/components/BadgeWithTooltip';
import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { TextRegularSm, TextRegularXs, TextTitleSm } from '@/app/components/base/text';
import { EditAgentCredentialsModal } from '@/app/components/EditAgentCredentialsModal';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useAgentCredentials } from '@/hooks/use-agent-credentials';
import { AiAgentCredential } from '@/types/server-entities/agent-credentials';
import {
  Alert,
  Badge,
  Box,
  Center,
  Grid,
  Group,
  Loader,
  Modal,
  Progress,
  Stack,
  Text,
  useModalsStack,
} from '@mantine/core';
import { PencilLineIcon, PlusIcon, ToggleLeftIcon, ToggleRightIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

export const AgentCredentials = () => {
  const { agentCredentials, isLoading, error, deleteCredentials, toggleCredential } = useAgentCredentials(true);
  const modalStack = useModalsStack(['edit', 'confirm-delete']);
  const [activeCredential, setActiveCredential] = useState<AiAgentCredential | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
            <SecondaryButton onClick={() => modalStack.close('confirm-delete')}>Cancel</SecondaryButton>
            <PrimaryButton
              onClick={() => {
                deleteCredentials(deleteId!);
                modalStack.close('confirm-delete');
                setDeleteId(null);
              }}
            >
              Delete
            </PrimaryButton>
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

  const buildUsageElement = (credential: AiAgentCredential): React.ReactNode => {
    if (!credential.usage) {
      return null;
    }

    // limit is 0 for unlimited, set arbitrary high max for the progress bar
    const max = credential.usage.limit === 0 ? 10000 : credential.usage.limit;
    const value = credential.usage.usage === 0 ? 0 : (credential.usage.usage / max) * 100;

    return (
      <Stack w="100%" gap="xs">
        <Progress color="primary" value={value} striped />
        <TextRegularXs c="dimmed">{`${credential.usage.usage} used out of ${credential.usage.limit === 0 ? 'unlimited' : '$' + credential.usage.limit} limit`}</TextRegularXs>
      </Stack>
    );
  };

  const sortedCredentials =
    agentCredentials?.sort((a, b) => {
      return a.createdAt.localeCompare(b.createdAt);
    }) || [];

  const list = isLoading ? (
    <Center mih={200}>
      <Group gap="xs">
        <Loader />
        <Text>Loading...</Text>
      </Group>
    </Center>
  ) : agentCredentials && agentCredentials.length > 0 ? (
    <>
      {sortedCredentials.map((credential) => (
        <Grid key={credential.id} align="flex-start">
          <Grid.Col span={3}>
            <Group gap="xs">
              <TextRegularSm>{getServiceIcon(credential.service)}</TextRegularSm>
              {credential.enabled ? (
                <Badge color="primary" variant="light" size="xs">
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
              {credential.default && (
                <Badge color="primary" variant="light" size="xs">
                  Default
                </Badge>
              )}
            </Group>
          </Grid.Col>
          <Grid.Col span={6}>
            <Stack gap="xs">
              <TextRegularSm>{credential.label}</TextRegularSm>
              <TextRegularXs c="dimmed">{credential.description}</TextRegularXs>
              {buildUsageElement(credential)}
            </Stack>
          </Grid.Col>
          <Grid.Col span={3}>
            <Group gap="4px" justify="flex-end" align="flex-end">
              <ToolIconButton
                size="md"
                onClick={async () => {
                  // toggle the credential
                  try {
                    setSaving(true);
                    await toggleCredential(credential.id, !credential.enabled);
                  } catch (error) {
                    console.error('Error toggling credential', error);
                  } finally {
                    setSaving(false);
                  }
                }}
                icon={credential.enabled ? ToggleRightIcon : ToggleLeftIcon}
                loading={saving}
              />
              <ToolIconButton
                size="md"
                onClick={() => {
                  setActiveCredential(credential);
                  modalStack.open('edit');
                }}
                icon={PencilLineIcon}
                disabled={credential.source === 'SYSTEM'}
              />
              <ToolIconButton
                size="md"
                onClick={() => {
                  setDeleteId(credential.id);
                  modalStack.open('confirm-delete');
                }}
                icon={Trash2Icon}
                disabled={credential.source === 'SYSTEM'}
              />
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
      <Box>
        <TextTitleSm mb="xs">Agent Credentials</TextTitleSm>
        {error && (
          <Alert color="red" mb="sm">
            {error.toString()}
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
            leftSection={<PlusIcon size={16} />}
          >
            New credential
          </PrimaryButton>
        </Group>
      </Box>
    </>
  );
};
