'use client';

import capitalize from 'lodash/capitalize';

import { Text9Regular, TextMono12Regular } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { useDevTools } from '@/hooks/use-dev-tools';
import { AgentProgressMessageData, AgentResponseDataPayload, UsageStats } from '@/types/agent-websocket';
import { ChatMessage } from '@/types/server-entities/agent';
import { timeAgo } from '@/utils/helpers';
import { formatTokenCount } from '@/utils/token-counter';
import { ActionIcon, Box, Code, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Coins,
  FoldVerticalIcon,
  UnfoldVerticalIcon,
} from 'lucide-react';
import { MarkdownRenderer } from '../../../../components/markdown/MarkdownRenderer';
import classes from './ChatMessageElement.module.css';

const LocalAdminMessage = ({ msg }: { msg: string }) => {
  return (
    <Text size="xs" c="dimmed" pl="xs" ta="center">
      {msg}
    </Text>
  );
};

const BasicMessage = ({ msg }: { msg: string }) => {
  return (
    <TextMono12Regular c="dimmed" pl="xs" style={{ textTransform: 'uppercase' }}>
      [{msg}]
    </TextMono12Regular>
  );
};

const formatToolName = (toolName: string) => {
  return capitalize(toolName.replaceAll('_', ' ').trim());
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
    <ActionIcon variant="transparent-hover" color="gray" size="xs" onClick={() => toggle()}>
      {isExpanded ? (
        <StyledLucideIcon Icon={ChevronUpIcon} size={14} />
      ) : (
        <StyledLucideIcon Icon={ChevronDownIcon} size={14} />
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
        <FoldVerticalIcon color="var(--mantine-color-gray-5)" />
      ) : (
        <UnfoldVerticalIcon color="var(--mantine-color-gray-5)" />
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
    return <BasicMessage msg={msg.message} />;
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
      // The payload structure: payload.payload contains the data dict from the server
      const dataPayload = payload.payload || {};
      // console.debug('request_sent payload:', { payload, dataPayload, msgPayload: msg.payload });
      const estimatedTokens = dataPayload['estimated_tokens'] as number | undefined;
      let displayMessage = showDetailedProgress ? msg.message : 'Request Sent';

      if (estimatedTokens !== undefined && estimatedTokens !== null && estimatedTokens > 0) {
        const formattedTokens = formatTokenCount(estimatedTokens);
        displayMessage = `Request Sent - ~${formattedTokens} tokens (estimated)`;
      }

      return <BasicMessage msg={displayMessage} />;
    }

    if (payload.progress_type === 'model_response') {
      // The payload structure: payload.payload contains the data dict from the server
      const dataPayload = payload.payload || {};
      const responseTokens = dataPayload['response_tokens'] as number | undefined;
      const requestTokens = dataPayload['request_tokens'] as number | undefined;
      const totalTokens = dataPayload['total_tokens'] as number | undefined;

      let displayMessage = showDetailedProgress ? msg.message : 'Response Received';

      if (totalTokens !== undefined && totalTokens !== null && totalTokens > 0) {
        const formattedTotal = formatTokenCount(totalTokens);
        const formattedRequest = requestTokens ? formatTokenCount(requestTokens) : '0';
        const formattedResponse = responseTokens ? formatTokenCount(responseTokens) : '0';
        displayMessage = `Response Received - ${formattedTotal} tokens (${formattedRequest} request, ${formattedResponse} response)`;
      }
      return <BasicMessage msg={displayMessage} />;
    }

    if (payload.progress_type === 'build_response') {
      return <BasicMessage msg={msg.message} />;
    }
  }

  // Extract usage stats for response messages
  const usageStats: UsageStats | null =
    msg.variant === 'message' && msg.role === 'assistant' && msg.payload
      ? (msg.payload as AgentResponseDataPayload).usage_stats || null
      : null;

  const usageTooltipContent = usageStats ? (
    <Box>
      <Box mb="xs">
        <Text size="xs" fw={600} component="span">
          requests:
        </Text>{' '}
        <Text size="xs" component="span">
          {usageStats.requests}
        </Text>
      </Box>
      <Box mb="xs">
        <Text size="xs" fw={600} component="span">
          request tokens:
        </Text>{' '}
        <Text size="xs" component="span">
          {formatTokenCount(usageStats.request_tokens)}
        </Text>
      </Box>
      <Box mb="xs">
        <Text size="xs" fw={600} component="span">
          response tokens:
        </Text>{' '}
        <Text size="xs" component="span">
          {formatTokenCount(usageStats.response_tokens)}
        </Text>
      </Box>
      <Box>
        <Text size="xs" fw={600} component="span">
          total tokens:
        </Text>{' '}
        <Text size="xs" component="span">
          {formatTokenCount(usageStats.total_tokens)}
        </Text>
      </Box>
    </Box>
  ) : null;

  const icon =
    msg.variant === 'error' ? (
      <StyledLucideIcon Icon={AlertCircleIcon} size={14} c="var(--mantine-color-red-8)" mt={4} />
    ) : null;

  return (
    <Stack gap="4px" w="100%">
      <Paper className={classes.chatMessageRoot} data-chat-role={msg.role} data-chat-variant={msg.variant}>
        {icon ? (
          <Group wrap="nowrap" align="flex-start">
            {icon}
            <Box flex={1}>
              <MarkdownRenderer>{msg.message}</MarkdownRenderer>
            </Box>
          </Group>
        ) : (
          <MarkdownRenderer>{msg.message}</MarkdownRenderer>
        )}
        <Text9Regular ta="right" c="dimmed">
          {timeAgo(msg.timestamp)}
        </Text9Regular>
      </Paper>
      <Group gap="xs" justify="flex-end" align="center">
        {usageStats && (
          // TODO: Fix this tooltip
          <Tooltip label={usageTooltipContent} withArrow>
            <Box style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}>
              <StyledLucideIcon Icon={Coins} size={10} c="dimmed" centerInText />
            </Box>
          </Tooltip>
        )}
      </Group>
    </Stack>
  );
};
