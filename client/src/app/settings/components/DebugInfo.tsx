import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { ActionIcon, Card, CheckIcon, CopyButton, Group, Text, Title, Tooltip } from '@mantine/core';
import { CopyIcon } from '@phosphor-icons/react';

export const DebugInfo = () => {
  const { user } = useScratchPadUser();

  return (
    <Card shadow="sm" padding="sm" radius="md" withBorder>
      <Title order={3} mb="xs">
        Debug
      </Title>
      <Group wrap="nowrap" gap="xs">
        <Text miw={200}>User ID</Text>
        <Text>{user?.id || 'No user ID found'}</Text>
        <CopyButton value={user?.id || ''} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : `${user?.id}`} withArrow position="right">
              <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
      <Group wrap="nowrap" gap="xs">
        <Text miw={200}>Created</Text>
        <Text>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'No created at found'}</Text>
      </Group>
      <Group wrap="nowrap" gap="xs">
        <Text miw={200}>Agent Key</Text>
        <Text>{user?.agentToken || 'No API key found'}</Text>
        <CopyButton value={user?.agentToken || ''} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : `${user?.agentToken}`} withArrow position="right">
              <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
      <Group wrap="nowrap" gap="xs">
        <Text miw={200}>Websocket Key</Text>
        <Text>{user?.websocketToken || 'No API key found'}</Text>
        <CopyButton value={user?.websocketToken || ''} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : `${user?.websocketToken}`} withArrow position="right">
              <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
    </Card>
  );
};
