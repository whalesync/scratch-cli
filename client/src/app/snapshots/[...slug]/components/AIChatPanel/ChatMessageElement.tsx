'use client';

import { AgentProgressMessageData } from '@/hooks/use-agent-chat-websocket';
import { useDevTools } from '@/hooks/use-dev-tools';
import { ChatMessage } from '@/types/server-entities/chat-session';
import { timeAgo } from '@/utils/helpers';
import { ActionIcon, Box, Code, Group, Paper, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import _ from 'lodash';
import { FoldVerticalIcon, UnfoldVerticalIcon } from 'lucide-react';
import { MarkdownRenderer } from '../../../../components/markdown/MarkdownRenderer';

const LocalAdminMessage = ({ msg }: { msg: string }) => {
  return (
    <Text size="xs" c="dimmed" pl="xs" ta="center">
      {msg}
    </Text>
  );
};

const BasicMessage = ({ msg }: { msg: string }) => {
  return (
    <Text size="xs" c="dimmed" pl="xs" style={{ textTransform: 'uppercase' }}>
      [{msg}]
    </Text>
  );
};

const formatToolName = (toolName: string) => {
  return _.capitalize(toolName.replaceAll('_', ' ').trim());
};

// interface ToolCallPayload {
//   tool_call_id: string;
//   tool_name: string;
//   args: Record<string, unknown>;
// }
const AgentToolCallMessage = ({ msg }: { msg: ChatMessage }) => {
  const data = msg.payload as AgentProgressMessageData;
  const [isExpanded, { toggle }] = useDisclosure(false);

  const { isDevToolsEnabled } = useDevTools();

  const displayMessage = `Called tool '${formatToolName(data.payload['tool_name'] as string)}'`;

  if (!isDevToolsEnabled) {
    return <BasicMessage msg={displayMessage} />;
  }

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
    <ActionIcon variant="transparent" size="xs" onClick={() => toggle()}>
      {isExpanded ? (
        <UnfoldVerticalIcon color="var(--mantine-color-gray-5)" />
      ) : (
        <FoldVerticalIcon color="var(--mantine-color-gray-5)" />
      )}
    </ActionIcon>
  ) : null;

  return (
    <Stack p={0} gap="xs">
      <Group p={0} gap="xs">
        <BasicMessage msg={displayMessage} />
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
//   tool_name: string;
//   content: string;
// }

const AgentToolCallResultMessage = ({ msg }: { msg: ChatMessage }) => {
  const data = msg.payload as AgentProgressMessageData;
  const [isExpanded, { toggle }] = useDisclosure(false);
  const { isDevToolsEnabled } = useDevTools();

  const displayMessage = `Tool result received '${formatToolName(data.payload['tool_name'] as string)}'`;

  if (!isDevToolsEnabled) {
    return <BasicMessage msg={displayMessage} />;
  }

  let responseContent = '';
  if (data) {
    responseContent = data.payload['content'] as string;
  }

  const toggleButton = responseContent ? (
    <ActionIcon variant="transparent" size="xs" onClick={() => toggle()}>
      {isExpanded ? (
        <UnfoldVerticalIcon color="var(--mantine-color-gray-5)" />
      ) : (
        <FoldVerticalIcon color="var(--mantine-color-gray-5)" />
      )}
    </ActionIcon>
  ) : null;

  return (
    <Stack p={0} gap="xs">
      <Group p="0" gap="xs">
        <BasicMessage msg={displayMessage} />
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

const DETAILED_PROGRESS_MESSAGE_TYPES = ['run_started', 'status', 'tool_result', 'build_response', 'create_agent'];

export const ChatMessageElement = ({
  msg,
  showDetailedProgress = false,
}: {
  msg: ChatMessage;
  showDetailedProgress?: boolean;
}) => {
  if (msg.variant === 'admin') {
    return <LocalAdminMessage msg={msg.message} />;
  }

  if (msg.variant === 'usage') {
    return showDetailedProgress ? <BasicMessage msg={msg.message} /> : null;
  }

  if (msg.variant === 'progress') {
    const payload = msg.payload as AgentProgressMessageData;

    if (!showDetailedProgress && DETAILED_PROGRESS_MESSAGE_TYPES.includes(payload.progress_type)) {
      return null;
    }

    if (payload.progress_type === 'run_started') {
      return null;
    }

    if (payload.progress_type === 'status') {
      return <BasicMessage msg={msg.message} />;
    }

    if (payload.progress_type === 'tool_call') {
      return <AgentToolCallMessage msg={msg} />;
    }

    if (payload.progress_type === 'tool_result') {
      return <AgentToolCallResultMessage msg={msg} />;
    }

    if (payload.progress_type === 'request_sent') {
      return <BasicMessage msg={showDetailedProgress ? msg.message : 'Request Sent'} />;
    }

    if (payload.progress_type === 'build_response') {
      return <BasicMessage msg={msg.message} />;
    }
  }

  const bgColor = msg.role === 'user' ? 'transparent' : 'transparent';
  const border =
    msg.variant === 'error'
      ? '1px solid red'
      : msg.role === 'user'
        ? '1px solid var(--mantine-color-gray-2)'
        : '1px solid transparent';
  const alignment = msg.role === 'user' ? 'flex-end' : 'flex-start';
  const maxWidth = msg.role === 'user' ? '90%' : '100%';
  const padding = '4px';

  let content = null;
  if (msg.role === 'user') {
    content = <Text size="xs">{msg.message}</Text>;
  } else {
    content = (
      <Box fz="xs" style={{ overflow: 'hidden' }}>
        <MarkdownRenderer>{msg.message}</MarkdownRenderer>
      </Box>
    );
  }

  return (
    <Paper
      p={padding}
      bg={bgColor}
      bd={border}
      bdrs="0px"
      style={{
        alignSelf: alignment,
        maxWidth: maxWidth,
      }}
      w="100%"
    >
      <Stack gap="4px" w="100%">
        {content}
        <Text c="dimmed" fz="8px" ta="right">
          {timeAgo(msg.timestamp)}
        </Text>
      </Stack>
    </Paper>
  );
};
