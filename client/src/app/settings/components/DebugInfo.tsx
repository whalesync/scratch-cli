import { TextTitleLg } from '@/app/components/base/text';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { ActionIcon, Badge, Card, CheckIcon, CopyButton, Group, PasswordInput, Text, Tooltip } from '@mantine/core';
import { CopyIcon } from '@phosphor-icons/react';

export const DebugInfo = () => {
  const { user, isAdmin } = useScratchPadUser();

  return (
    <Card shadow="sm" padding="sm" radius="md" withBorder>
      <TextTitleLg mb="xs">Debug</TextTitleLg>
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
        {isAdmin && <Badge size="xs">Admin</Badge>}
      </Group>
      <Group wrap="nowrap" gap="xs">
        <Text miw={200}>Created</Text>
        <Text>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'No created at found'}</Text>
      </Group>
      <Group wrap="nowrap" gap="xs">
        <Text miw={200}>Agent Token</Text>
        <PasswordInput
          variant="unstyled"
          value={user?.agentToken}
          placeholder="No API key found"
          readOnly
          inputWrapperOrder={['input', 'label', 'description', 'error']}
          flex={1}
        />
        <CopyButton value={user?.agentToken || ''} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : `Copy agent API token`} withArrow position="right">
              <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
      <Group wrap="nowrap" gap="xs">
        <Text miw={200}>Websocket Token</Text>
        <PasswordInput
          variant="unstyled"
          value={user?.websocketToken}
          placeholder="No API key found"
          readOnly
          inputWrapperOrder={['input', 'label', 'description', 'error']}
          flex={1}
        />
        <CopyButton value={user?.websocketToken || ''} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : `Copy websocket API token`} withArrow position="right">
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
