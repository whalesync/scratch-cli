'use client';

import { AdvancedAgentInput } from '@/app/components/AdvancedAgentInput/AdvancedAgentInput';
import { Command } from '@/app/components/AdvancedAgentInput/CommandSuggestions';
import { ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useAgentChatContext } from '@/app/workbooks/[...slug]/components/contexts/agent-chat-context';
import { useAIAgentSessionManagerContext } from '@/contexts/ai-agent-session-manager-context';
import { AgentProgressMessageData, useAIAgentChatWebSocket, WebSocketMessage } from '@/hooks/use-agent-chat-websocket';
import { useAgentCredentials } from '@/hooks/use-agent-credentials';
import { usePromptAssets } from '@/hooks/use-prompt-assets';
import {
  trackChangeAgentCapabilities,
  trackChangeAgentModel,
  trackOpenOldChatSession,
  trackSendMessage,
  trackStartAgentSession,
} from '@/lib/posthog';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { AGENT_CAPABILITIES, Capability, SendMessageRequestDTO } from '@/types/server-entities/agent';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { sleep } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import { formatTokenCount } from '@/utils/token-counter';
import { ActionIcon, Alert, Box, Button, Center, Group, Modal, Paper, Stack, Text, Tooltip } from '@mantine/core';
import _ from 'lodash';
import {
  ChevronDownIcon,
  LucideFileKey,
  MessagesSquareIcon,
  OctagonMinusIcon,
  Plus,
  SendIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useActiveWorkbook } from '../../../../../hooks/use-active-workbook';
import { Text12Regular, TextTitle3 } from '../../../../components/base/text';
import ModelPicker from '../../../../components/ModelPicker';
import classes from './AIChatPanel.module.css';
import CapabilitiesButton from './CapabilitiesButton';
import ToolsModal from './CapabilitiesModal';
import { ChatMessageElement } from './ChatMessageElement';
import { ContextBadges } from './ContextBadges';
import { PromptAssetSelector } from './PromptAssetSelector';
import { SessionHistorySelector } from './SessionHistorySelector';

interface AIChatPanelProps {
  activeTable: SnapshotTable | null;
}

export default function AIChatPanel({ activeTable }: AIChatPanelProps) {
  const { workbook } = useActiveWorkbook();
  const { activeOpenRouterCredentials } = useAgentCredentials();
  const { closeChat, openPublishConfirmation } = useWorkbookEditorUIStore();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [resetInputFocus, setResetInputFocus] = useState(false);
  const [showDeleteSessionButton, setShowDeleteSessionButton] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const { dataScope, activeRecordId, activeColumnId, activeResources, activeModel, setActiveModel } =
    useAgentChatContext();

  const {
    activeSessionId,
    activeSession,
    createSession,
    deleteSession,
    activateSession,
    clearActiveSession,
    cancelAgentRun,
    refreshSessions,
  } = useAIAgentSessionManagerContext();
  const [agentTaskRunning, setAgentTaskRunning] = useState<boolean>(false);
  const [runningAgentTaskId, setRunningAgentTaskId] = useState<string | null>(null);

  const { promptAssets } = usePromptAssets();

  // Commands for the AdvancedAgentInput
  const commands: Command[] = [
    {
      id: 'cmd1',
      display: 'tools',
      description: 'Open tools modal',
      execute: () => setShowToolsModal(true),
    },
    {
      id: 'cmd2',
      display: 'publish',
      description: 'Publish data to remote service',
      execute: () => handlePublish(),
    },
    {
      id: 'cmd3',
      display: '/',
      description: 'Revert last action',
      execute: () => {
        console.debug('TODO: Implement revert last action logic');
      },
    },
  ];

  // const [availableCapabilities, setAvailableCapabilities] = useState<Capability[]>([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);

  // Load selected capabilities from localStorage on mount, or use defaults
  useEffect(() => {
    const STORAGE_KEY = 'ai-chat-selected-capabilities';
    const savedCapabilities = localStorage.getItem(STORAGE_KEY);

    if (savedCapabilities) {
      try {
        const parsed = JSON.parse(savedCapabilities);
        setSelectedCapabilities(parsed);
      } catch (error) {
        console.warn('Failed to parse saved capabilities:', error);
        // Fall back to defaults
        const defaultCapabilities = AGENT_CAPABILITIES.filter((cap: Capability) => cap.enabledByDefault).map(
          (cap: Capability) => cap.code,
        );
        setSelectedCapabilities(defaultCapabilities);
      }
    } else {
      // No saved capabilities, use defaults
      const defaultCapabilities = AGENT_CAPABILITIES.filter((cap: Capability) => cap.enabledByDefault).map(
        (cap: Capability) => cap.code,
      );
      setSelectedCapabilities(defaultCapabilities);
    }
  }, []); // availableCapabilities is a constant, no need to include in dependencies

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [scrollAreaRef]);

  const handleWebsocketMessage = useCallback(
    async (message: WebSocketMessage) => {
      // this is just to handle some flow control for the UI.
      // The hook already tracks the message history and we can use that for the UI
      if (message.type === 'message_progress') {
        const payload = message.data as AgentProgressMessageData;
        if (payload.progress_type === 'run_started') {
          setRunningAgentTaskId(payload.payload['run_id'] as string);
        }
      } else if (message.type === 'message_response') {
        setAgentTaskRunning(false);
        setRunningAgentTaskId(null);
        setResetInputFocus(true);
        await refreshSessions();
      } else if (message.type === 'agent_error') {
        setAgentTaskRunning(false);
        setRunningAgentTaskId(null);
        setResetInputFocus(true);
      }
      // got a message, try to scroll to the bottom
      scrollToBottom();
    },
    [scrollToBottom, refreshSessions],
  );

  const {
    connectionStatus,
    connectionError,
    connect,
    disconnect,
    messageHistory,
    sendPing,
    sendAiAgentMessage,
    clearChat,
  } = useAIAgentChatWebSocket({
    onMessage: handleWebsocketMessage,
  });

  useEffect(() => {
    if (resetInputFocus && connectionStatus === 'connected') {
      textInputRef.current?.focus();
      setResetInputFocus(false);
    }
  }, [resetInputFocus, connectionStatus]);

  const createNewSession = async () => {
    if (!activeOpenRouterCredentials) {
      setError('You must configure your OpenRouter credentials to use the AI agent');
      return;
    }

    if (!workbook) {
      setError('Workbook ID is required to create a session');
      return;
    }

    try {
      await disconnect();
      await sleep(100);
      const { session } = await createSession(workbook.id);
      connect(session.id);
      trackStartAgentSession(workbook);
      setError(null);
      setMessage('');
      setResetInputFocus(true);
      scrollToBottom();
    } catch (error) {
      setError(`Failed to create session: ${error}}`);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !activeSessionId || agentTaskRunning) return;
    const messageCleaned = message.trim();

    // handle slash (/) and (@) commands
    if (messageCleaned.startsWith('/') || messageCleaned.startsWith('@')) {
      if (messageCleaned === '/ping') {
        sendPing();
      }

      if (messageCleaned === '/clear') {
        clearChat();
      }

      if (messageCleaned === '/new') {
        await disconnect();
        await createNewSession();
      }

      setMessage('');
      scrollToBottom();
      return;
    }

    setAgentTaskRunning(true);
    setError(null);

    try {
      // Get selected style guide content
      const selectedPromptAssets = promptAssets.filter((pa) => activeResources.includes(pa.id));

      // Extract table IDs from mentions in the message
      // Format: $[Table Name](tbl_tableId)
      const tableMentionPattern = /\$\[([^\]]+)\]\(tbl_([^)]+)\)/g;
      const tableMentions = [...message.matchAll(tableMentionPattern)];
      const mentionedTableIds = tableMentions.map((match) => match[2]); // Extract tableId from tbl_tableId

      const messageData: SendMessageRequestDTO = {
        message: message.trim(),
        model: activeModel.value,
        credential_id: activeOpenRouterCredentials?.id,
        capabilities: selectedCapabilities,
      };

      // Include model context length if available
      if (activeModel.contextLength) {
        messageData.model_context_length = activeModel.contextLength;
      }

      // Include mentioned table IDs if any
      if (mentionedTableIds.length > 0) {
        messageData.mentioned_table_ids = mentionedTableIds;
      }

      // Include style guide content if selected
      if (selectedPromptAssets.length > 0) {
        messageData.style_guides = selectedPromptAssets.map((sg) => ({
          name: sg.name,
          content: sg.body,
        }));
      }

      if (activeTable) {
        messageData.active_table_id = activeTable.id;
      }

      if (dataScope) {
        messageData.data_scope = dataScope;
        messageData.record_id = activeRecordId;
        messageData.column_id = activeColumnId;
      }

      trackSendMessage(message.length, selectedPromptAssets.length, dataScope, workbook);
      sendAiAgentMessage(messageData);

      // clear the current message
      setMessage('');
    } catch (error) {
      setError('Failed to send agent message');
      setErrorDetails(error instanceof Error ? error.message : 'Unknown error');
      console.error('Exception while sending message:', error);
      setAgentTaskRunning(false);
    }
  };

  const handlePublish = () => {
    if (!workbook) return;
    openPublishConfirmation();
  };

  const handleTextInputFocus = async () => {
    if (!activeSessionId) {
      // no active session, so we need to create a new one
      await createNewSession();
    }
    if (activeSessionId && connectionStatus !== 'connected') {
      // active session, but not connected, so we need to connect to the session
      await connect(activeSessionId);
    }
  };

  // combine the historical session data and the current websocket message history
  const chatHistory = [...(messageHistory || [])];

  // Merge the session chat history with the active chat history
  // There might be duplicates as the activeSession gets refreshed by useSWR
  if (activeSession?.chat_history && activeSession.chat_history.length > 0) {
    const pastMsgs = activeSession.chat_history.filter(
      (msg) => !chatHistory.some((m) => m.message === msg.message && m.role === msg.role),
    );
    chatHistory.unshift(...pastMsgs);
  }
  // NOTE(chris): fake messages to test scrolling -- uncomment to if you want to test scrolling behavior, or div boundaries
  // for (let i = 0; i < 30; i++) {
  //   chatHistory.push({
  //     id: Date.now().toString(),
  //     message: `message ${i}`,
  //     role: 'user',
  //     timestamp: new Date().toISOString(),
  //     variant: 'message',
  //   });
  // }
  const chatInputEnabled =
    activeOpenRouterCredentials && activeSessionId && connectionStatus === 'connected' && !agentTaskRunning;

  return (
    <Paper
      h="100%"
      style={{
        display: 'flex',
        flexDirection: 'column',
      }}
      p={0}
      bd="1px solid var(--mantine-color-gray-4)"
    >
      <Box h="40px" className={classes.chatPanelHeader}>
        <Group align="center" wrap="nowrap" h="100%" gap="2px">
          <ToolIconButton icon={MessagesSquareIcon} onClick={closeChat} size="sm" />
          <Group
            gap="2px"
            flex={1}
            onMouseEnter={() => setShowDeleteSessionButton(true)}
            onMouseLeave={() => setShowDeleteSessionButton(false)}
          >
            <TextTitle3>
              {activeSession ? _.truncate(activeSession.name, { length: 30, omission: '...' }) : 'Chat'}
            </TextTitle3>
            {activeSession && showDeleteSessionButton && (
              <ActionIcon
                onClick={async () => {
                  if (!activeSessionId) return;
                  await disconnect();
                  await clearActiveSession();
                  await deleteSession(activeSessionId);
                }}
                size="sm"
                variant="transparent-hover"
                color="gray"
                title="Delete session"
                disabled={!activeSessionId}
              >
                <StyledLucideIcon Icon={XIcon} size={14} />
              </ActionIcon>
            )}
          </Group>
          <Group gap="xs" ml="auto">
            <ActionIcon
              onClick={createNewSession}
              size="sm"
              variant="transparent-hover"
              color="gray"
              title="New chat"
              disabled={!activeOpenRouterCredentials}
            >
              <StyledLucideIcon Icon={Plus} size={14} />
            </ActionIcon>
            <SessionHistorySelector
              disabled={!activeOpenRouterCredentials}
              onSelect={async (sessionId: string) => {
                if (sessionId) {
                  await disconnect();
                  try {
                    await activateSession(sessionId);
                    await connect(sessionId);
                    trackOpenOldChatSession(workbook);
                    setMessage('');
                    setResetInputFocus(true);
                    scrollToBottom();
                  } catch (error) {
                    setError(`Failed to activate session: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                } else {
                  clearActiveSession();
                  await disconnect();
                }
              }}
            />
          </Group>
        </Group>
      </Box>
      <Box w="100%" h="100%" className={classes.chatPanelBody} ref={scrollAreaRef}>
        {/* Error Alert */}
        {error && (
          <Alert color="red" mb="sm" p="xs" title={error} withCloseButton onClose={() => setError(null)}>
            {errorDetails && (
              <Text size="xs" c="dimmed">
                {errorDetails}
              </Text>
            )}
          </Alert>
        )}

        {connectionError && (
          <Alert color="red" mb="sm" p="xs">
            <Text size="xs" c="dimmed">
              {connectionError}
            </Text>
          </Alert>
        )}

        {/* Messages */}

        {activeSessionId ? (
          <Stack gap="xs">
            {chatHistory.map((msg, index) => (
              <ChatMessageElement key={index} msg={msg} />
            ))}
          </Stack>
        ) : (
          <Center h="100%">
            {activeOpenRouterCredentials ? (
              <Button
                variant="transparent"
                leftSection={<SparklesIcon size={16} />}
                onClick={createNewSession}
                size="xs"
                w="fit-content"
                color="gray.7"
                c="gray.7"
              >
                Start new chat
              </Button>
            ) : (
              <Stack gap="xs" justify="center" align="center">
                <Text size="xs" c="dimmed">
                  You must configure your OpenRouter credentials to use the AI agent
                </Text>
                <ButtonSecondaryOutline component="a" href={RouteUrls.settingsPageUrl} size="xs" w="fit-content">
                  Configure credentials
                </ButtonSecondaryOutline>
              </Stack>
            )}
          </Center>
        )}
      </Box>
      <Box mih="150px" className={classes.chatPanelFooter}>
        <Stack gap="2xs" my="2xs">
          <PromptAssetSelector
            disabled={!activeOpenRouterCredentials}
            workbook={workbook}
            resetInputFocus={() => textInputRef.current?.focus()}
          />
          <ContextBadges />
        </Stack>
        {/* User Input for Chat */}
        <AdvancedAgentInput
          tableId={activeTable?.id || ''}
          workbook={workbook}
          onMessageChange={setMessage}
          onSendMessage={sendMessage}
          disabled={agentTaskRunning || !activeOpenRouterCredentials}
          onFocus={handleTextInputFocus}
          commands={commands}
        />

        {/* Model and Submit Row */}
        <Group gap="xs" align="flex-end">
          <Tooltip
            multiline
            w={220}
            label={`Using ${activeOpenRouterCredentials?.label} key. ${activeOpenRouterCredentials?.description}`}
          >
            <Box>
              <StyledLucideIcon Icon={LucideFileKey} size="md" c="dimmed" strokeWidth={1} />
            </Box>
          </Tooltip>

          <Button
            variant="transparent"
            onClick={() => setShowModelSelector(true)}
            disabled={!activeOpenRouterCredentials}
            c="gray"
            size="xs"
            p="0px"
            rightSection={<ChevronDownIcon size={12} color="gray" />}
          >
            <Text12Regular component="span" c="dimmed">
              {`${activeModel.value} (${formatTokenCount(activeModel.contextLength ?? 1)})`}
            </Text12Regular>
          </Button>
          {/* Capabilities Selection */}
          <CapabilitiesButton
            selectedCapabilities={selectedCapabilities}
            availableCapabilitiesCount={AGENT_CAPABILITIES.length}
            onClick={() => setShowToolsModal(true)}
          />

          <Group gap="2px" ml="auto">
            <ActionIcon
              onClick={() => {
                if (runningAgentTaskId) {
                  cancelAgentRun(runningAgentTaskId);
                }
              }}
              size="md"
              variant="transparent-hover"
              title="Cancel task"
              disabled={!runningAgentTaskId || !agentTaskRunning}
            >
              <StyledLucideIcon Icon={OctagonMinusIcon} size={16} />
            </ActionIcon>
            <ActionIcon
              onClick={sendMessage}
              disabled={!message.trim() || !chatInputEnabled}
              loading={agentTaskRunning}
              size="md"
              variant="transparent-hover"
            >
              <StyledLucideIcon Icon={SendIcon} size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Box>
      {/* Model Selector Modal */}
      <Modal opened={showModelSelector} onClose={() => setShowModelSelector(false)} title="Select Model" size="xl">
        <ModelPicker
          currentModelOption={activeModel}
          onChange={(value) => {
            setActiveModel(value);
            trackChangeAgentModel(activeModel.value, workbook);
            setShowModelSelector(false);
          }}
        />
      </Modal>
      {/* Tools Modal */}
      <ToolsModal
        opened={showToolsModal}
        onClose={() => setShowToolsModal(false)}
        selectedCapabilities={selectedCapabilities}
        onCapabilitiesChange={(caps) => {
          setSelectedCapabilities(caps);
          const STORAGE_KEY = 'ai-chat-selected-capabilities';
          localStorage.setItem(STORAGE_KEY, JSON.stringify(caps));
          trackChangeAgentCapabilities(caps, workbook);
          setShowToolsModal(false);
        }}
      />
    </Paper>
  );
}
