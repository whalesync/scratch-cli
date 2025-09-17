'use client';

import { AgentProgressMessageData } from '@/hooks/use-agent-chat-websocket';
import { ChatMessage } from '@/types/server-entities/chat-session';
import { timeAgo } from '@/utils/helpers';
import { ActionIcon, Box, Code, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { MinusIcon, PlusIcon } from '@phosphor-icons/react';
import { StyledIcon } from '../../../../components/Icons/StyledIcon';
import { MarkdownRenderer } from '../../../../components/markdown/MarkdownRenderer';

const AgentAdminMessage = ({ msg }: { msg: ChatMessage }) => {
  return (
    <Text size="xs" c="dimmed" pl="xs">
      {msg.message}
    </Text>
  );
};

const AgentStatusMessage = ({ msg }: { msg: ChatMessage }) => {
  return (
    <Text size="xs" c="dimmed" pl="xs">
      {msg.message}
    </Text>
  );
};

const AgentToolCallMessage = ({ msg }: { msg: ChatMessage }) => {
  const data = msg.payload as AgentProgressMessageData;
  const [isExpanded, { toggle }] = useDisclosure(false);

  let displayArgs = '';
  if (data) {
    // const toolId = data.payload['tool_call_id'] as string;
    const args = data.payload['args'] as string;

    if (args) {
      try {
        displayArgs = JSON.stringify(JSON.parse(args), null, 2);
      } catch (e) {
        console.error(e);
      }
    }
  }
  const toggleButton = displayArgs ? (
    <Tooltip label={isExpanded ? 'Hide tool call arguments' : 'Show tool call arguments'}>
      <ActionIcon variant="transparent" size="xs" onClick={() => toggle()}>
        <StyledIcon Icon={isExpanded ? MinusIcon : PlusIcon} c="gray.5" />
      </ActionIcon>
    </Tooltip>
  ) : null;

  return (
    <Stack p={0} gap="xs">
      <Group p="0" gap="xs">
        <Text size="xs" c="dimmed" pl="xs">
          {msg.message}
        </Text>
        {toggleButton}
      </Group>
      {displayArgs && isExpanded && (
        <Box p="xs">
          <Code fz="12px" block styles={{ root: { whiteSpace: 'pre-wrap', backgroundColor: 'white' } }}>
            {displayArgs}
          </Code>
        </Box>
      )}
    </Stack>
  );
};

// interface ToolCallResultPayload {
//   tool_call_id: string;
//   content: string;
// }

const AgentToolCallResultMessage = ({ msg }: { msg: ChatMessage }) => {
  const data = msg.payload as AgentProgressMessageData;
  const [isExpanded, { toggle }] = useDisclosure(false);

  let responseContent = '';
  if (data) {
    responseContent = data.payload['content'] as string;
  }

  const toggleButton = responseContent ? (
    <Tooltip label={isExpanded ? 'Hide tool call result' : 'Show tool call result'}>
      <ActionIcon variant="transparent" size="xs" onClick={() => toggle()}>
        <StyledIcon Icon={isExpanded ? MinusIcon : PlusIcon} c="gray.5" />
      </ActionIcon>
    </Tooltip>
  ) : null;

  return (
    <Stack p={0} gap="xs">
      <Group p="0" gap="xs">
        <Text size="xs" c="dimmed" pl="xs">
          {msg.message}
        </Text>
        {toggleButton}
      </Group>
      {responseContent && isExpanded && (
        <Box p="xs">
          <Code fz="12px" block styles={{ root: { whiteSpace: 'pre-wrap', backgroundColor: 'white' } }}>
            {responseContent}
          </Code>
        </Box>
      )}
    </Stack>
  );
};

export const ChatMessageElement = ({ msg }: { msg: ChatMessage }) => {
  if (msg.variant === 'admin') {
    return <AgentAdminMessage msg={msg} />;
  }

  if (msg.variant === 'progress') {
    const payload = msg.payload as AgentProgressMessageData;

    if (payload.progress_type === 'run_started') {
      return null;
    }

    if (payload.progress_type === 'status') {
      return <AgentStatusMessage msg={msg} />;
    }

    if (payload.progress_type === 'tool_call') {
      return <AgentToolCallMessage msg={msg} />;
    }

    if (payload.progress_type === 'tool_result') {
      return <AgentToolCallResultMessage msg={msg} />;
    }
  }

  const bgColor = msg.role === 'user' ? 'blue.0' : 'white';
  const borderColor = msg.variant === 'error' ? '1px solid red' : '1px solid transparent';
  const alignment = msg.role === 'user' ? 'flex-end' : 'flex-start';
  const maxWidth = msg.role === 'user' ? '90%' : '100%';
  const padding = msg.role === 'user' ? '4px' : '0px';

  let content = null;
  if (msg.role === 'user') {
    content = <Text size="xs">{msg.message}</Text>;
  } else {
    content = (
      <Box fz="xs">
        <MarkdownRenderer>{msg.message}</MarkdownRenderer>
      </Box>
    );
  }

  return (
    <Paper
      p={padding}
      bg={bgColor}
      bd={borderColor}
      style={{
        alignSelf: alignment,
        maxWidth: maxWidth,
      }}
    >
      <Stack gap="4px">
        {content}
        <Text c="dimmed" fz="8px" ta="right">
          {timeAgo(msg.timestamp)}
        </Text>
      </Stack>
    </Paper>
  );
};
