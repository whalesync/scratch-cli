import { BadgeWithTooltip } from '@/app/components/BadgeWithTooltip';
import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { TextRegularSm, TextRegularXs, TextTitleSm } from '@/app/components/base/text';
import { EditAgentCredentialsModal } from '@/app/components/EditAgentCredentialsModal';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useAgentCredentials } from '@/hooks/use-agent-credentials';
import { useDevTools } from '@/hooks/use-dev-tools';
import { AiAgentCredential, CreditUsage } from '@/types/server-entities/agent-credentials';
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
import { useSetState } from '@mantine/hooks';
import {
  CircleDollarSignIcon,
  PencilLineIcon,
  PlusIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';

export const AgentCredentials = () => {
  const { agentCredentials, isLoading, error, deleteCredentials, getCreditUsage, toggleCredential } =
    useAgentCredentials();
  const modalStack = useModalsStack(['edit', 'confirm-delete']);
  const [activeCredential, setActiveCredential] = useState<AiAgentCredential | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { isDevToolsEnabled } = useDevTools();

  const [credentailUsage, setCredentialUsage] = useSetState<{
    [key: string]: CreditUsage | string;
  }>({});

  const handleGetCreditUsage = async (id: string) => {
    try {
      const creditUsage = await getCreditUsage(id);
      setCredentialUsage({ [`${id}`]: creditUsage });
    } catch (error) {
      console.error('Error fetching credit usage', error);
      setCredentialUsage({ [`${id}`]: 'Error fetching credit usage' });
    }
  };

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

  const getCreditUsageElement = (id: string): React.ReactNode => {
    if (!credentailUsage[id]) {
      return null;
    }
    const creditUsage = credentailUsage[id];
    if (typeof creditUsage === 'string') {
      return <TextRegularXs c="red.5">{creditUsage}</TextRegularXs>;
    }

    const max = creditUsage.totalCredits === 0 ? 100 : creditUsage.totalCredits;
    const value = creditUsage.totalUsage === 0 ? 0 : (creditUsage.totalUsage / max) * 100;

    return (
      <Stack w="100%" gap="xs">
        <Progress color="primary" value={value} striped />
        <TextRegularXs c="dimmed">{`${creditUsage.totalUsage} credits used out of ${creditUsage.totalCredits === 0 ? 'unlimited' : creditUsage.totalCredits}`}</TextRegularXs>
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
            </Group>
          </Grid.Col>
          <Grid.Col span={6}>
            <Stack gap="xs">
              <TextRegularSm>{credential.label}</TextRegularSm>
              <TextRegularXs c="dimmed">{credential.description}</TextRegularXs>
              {getCreditUsageElement(credential.id)}
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
              {isDevToolsEnabled && (
                <ToolIconButton
                  size="md"
                  onClick={() => handleGetCreditUsage(credential.id)}
                  icon={CircleDollarSignIcon}
                  tooltip="Check current credit balance"
                />
              )}
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
