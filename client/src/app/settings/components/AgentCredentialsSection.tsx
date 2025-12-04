import { ActionIconThreeDots } from '@/app/components/base/action-icons';
import { Badge } from '@/app/components/base/badge';
import { ButtonPrimaryLight } from '@/app/components/base/buttons';
import { Text13Book, Text13Regular } from '@/app/components/base/text';
import { ConfigSection } from '@/app/components/ConfigSection';
import { EditAgentCredentialsModal } from '@/app/components/EditAgentCredentialsModal';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import {
  GenericDeleteConfirmationModal,
  useDeleteConfirmationModal,
} from '@/app/components/modals/GenericDeleteConfirmationModal';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useAgentCredentials } from '@/hooks/use-agent-credentials';
import { useSubscription } from '@/hooks/use-subscription';
import { Alert, Center, Group, Menu, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { AgentCredential, AiAgentCredentialId } from '@spinner/shared-types';
import { CheckSquareIcon, Edit3Icon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CredentialLimit } from './CredentialLimit';

export const AgentCredentialsSection = () => {
  const { canCreateCredentials } = useSubscription();
  const { agentCredentials, isLoading, error, deleteCredentials, toggleDefaultCredential } = useAgentCredentials(true);
  const deleteModal = useDeleteConfirmationModal<AiAgentCredentialId>();
  const [isEditModalOpen, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [activeCredential, setActiveCredential] = useState<AgentCredential | null>(null);
  const [saving, setSaving] = useState(false);

  const sortedCredentials = useMemo(() => {
    return (
      agentCredentials?.sort((a, b) => {
        if (a.source === 'SYSTEM') {
          return -1;
        }
        if (b.source === 'SYSTEM') {
          return 1;
        }

        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }) || []
    );
  }, [agentCredentials]);

  const buildApiKeyElement = (credential: AgentCredential, isLast: boolean) => {
    const isScratchCredential = credential.source === 'SYSTEM';
    const tokenUsageWarning = null;
    return (
      <Group
        key={credential.id}
        p="10px 12px"
        align="flex-start"
        styles={
          isLast
            ? {
                root: { border: '0.5px solid var(--mantine-color-gray-4)' },
              }
            : {
                root: { border: '0.5px solid var(--mantine-color-gray-4)', borderBottom: 'none' },
              }
        }
      >
        <Group gap="6px" w="200px">
          <Text13Regular>{isScratchCredential ? 'Scratch' : credential.description}</Text13Regular>
          {credential.default && <Badge>Default</Badge>}
        </Group>
        <Stack gap="12px" flex="1">
          <Stack gap="2px">
            {!isScratchCredential && <Text13Regular>{credential.label}</Text13Regular>}
            {tokenUsageWarning && <Text13Book c="dimmed">{tokenUsageWarning}</Text13Book>}
          </Stack>
          <CredentialLimit credential={credential} />
        </Stack>
        <Group gap="4px" w="76px" justify="flex-end" align="flex-end">
          {!isScratchCredential && (
            <ToolIconButton
              size="sm"
              onClick={() => {
                setActiveCredential(credential);
                openEditModal();
              }}
              icon={Edit3Icon}
              disabled={isScratchCredential}
            />
          )}
          <Menu>
            <Menu.Target>
              <ActionIconThreeDots size="sm" />
            </Menu.Target>
            <Menu.Dropdown>
              <>
                <Menu.Item
                  onClick={async () => {
                    // toggle the credential
                    try {
                      setSaving(true);
                      await toggleDefaultCredential(credential.id);
                      ScratchpadNotifications.success({
                        message: 'Default credential set successfully',
                      });
                    } catch (error) {
                      console.error('Error toggling credential', error);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  leftSection={<CheckSquareIcon size={16} />}
                  disabled={credential.default || saving}
                >
                  Make default
                </Menu.Item>
              </>

              {!isScratchCredential && (
                <>
                  <Menu.Divider />
                  <Menu.Item
                    data-delete
                    onClick={() => deleteModal.open(credential.id as AiAgentCredentialId, credential.label)}
                    leftSection={<Trash2Icon size={16} />}
                  >
                    Delete
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    );
  };

  const list = isLoading ? (
    <Center mih={100}>
      <LoaderWithMessage message="Loading..." />
    </Center>
  ) : sortedCredentials && sortedCredentials.length > 0 ? (
    <Stack gap="0px" p="0">
      {sortedCredentials.map((credential, index) =>
        buildApiKeyElement(credential, index === sortedCredentials.length - 1),
      )}
    </Stack>
  ) : (
    <Center mih={200}>
      <Text>No credentials found</Text>
    </Center>
  );

  return (
    <>
      <ConfigSection
        title="OpenRouter API keys"
        description="Add your OpenRouterAPI keys here to enable the agent to use them."
        p="0"
        hasBorder={false}
      >
        {error && <Alert color="red">{error.toString()}</Alert>}
        {list && sortedCredentials.length > 0 && (
          <Stack gap="xs" mih={50}>
            {list}
          </Stack>
        )}

        {canCreateCredentials && (
          <Group p="10px 12px" justify="flex-end">
            <ButtonPrimaryLight
              size="xs"
              w="fit-content"
              onClick={() => {
                setActiveCredential(null);
                openEditModal();
              }}
              leftSection={<PlusIcon size={16} />}
            >
              Add API Key
            </ButtonPrimaryLight>
          </Group>
        )}
      </ConfigSection>
      <EditAgentCredentialsModal
        opened={isEditModalOpen}
        onClose={closeEditModal}
        credentials={activeCredential}
        onSuccess={() => {
          setActiveCredential(null);
          closeEditModal();
        }}
      />

      <GenericDeleteConfirmationModal
        title="Delete credential"
        onConfirm={async (id: AiAgentCredentialId) => await deleteCredentials(id)}
        {...deleteModal}
      />
    </>
  );
};
