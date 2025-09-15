'use client';

import { SecondaryButton } from '@/app/components/base/buttons';
import SideBarContent from '@/app/components/layouts/SideBarContent';
import { useAgentChatContext } from '@/app/snapshots/[...slug]/components/contexts/agent-chat-context';
import { useAIAgentSessionManagerContext } from '@/contexts/ai-agent-session-manager-context';
import { AgentProgressMessageData, useAIAgentChatWebSocket, WebSocketMessage } from '@/hooks/use-agent-chat-websocket';
import { useAgentCredentials } from '@/hooks/use-agent-credentials';
import { useStyleGuides } from '@/hooks/use-style-guide';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { Capability, SendMessageRequestDTO } from '@/types/server-entities/chat-session';
import { TableSpec } from '@/types/server-entities/snapshot';
import { ColumnView } from '@/types/server-entities/view';
import { sleep } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  BinocularsIcon,
  CellTowerIcon,
  ChatCircleIcon,
  EyeIcon,
  HeadCircuitIcon,
  PaperPlaneRightIcon,
  PlusIcon,
  SidebarSimpleIcon,
  StopCircleIcon,
  TableIcon,
  TagSimpleIcon,
  TrashIcon,
  VinylRecordIcon,
} from '@phosphor-icons/react';
import _ from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeWithTooltip } from '../../../../components/BadgeWithTooltip';
import { TextTitleSm } from '../../../../components/base/text';
import { StyledIcon } from '../../../../components/Icons/StyledIcon';
import ModelPicker from '../../../../components/ModelPicker';
import { useSnapshotContext } from '../contexts/SnapshotContext';
import CapabilitiesPicker from './CapabilitiesPicker';
import { ChatMessageElement } from './ChatMessageElement';
import { ResourceSelector } from './ResourceSelector';
import { SessionHistorySelector } from './SessionHistorySelector';

interface AIChatPanelProps {
  activeTable: TableSpec | null;
}

export default function AIChatPanel({ activeTable }: AIChatPanelProps) {
  const { snapshot, currentView } = useSnapshotContext();
  const { rightPanelOpened, toggleRightPanel } = useLayoutManagerStore();

  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [resetInputFocus, setResetInputFocus] = useState(false);

  const [showModelSelector, setShowModelSelector] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const {
    readFocus,
    writeFocus,
    dataScope,
    activeRecordId,
    activeColumnId,
    activeResources,
    activeModel,
    setActiveModel,
  } = useAgentChatContext();

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

  const { styleGuides } = useStyleGuides();

  const [availableCapabilities, setAvailableCapabilities] = useState<Capability[]>([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);

  const { aiAgentEnabled } = useAgentCredentials();

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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (activeSession?.chat_history && activeSession.chat_history.length > 0) {
      scrollToBottom();
    }
  }, [activeSession?.chat_history, scrollToBottom]);

  useEffect(() => {
    if (messageHistory && messageHistory.length > 0) {
      scrollToBottom();
    }
  }, [messageHistory, scrollToBottom]);

  useEffect(() => {
    if (resetInputFocus && connectionStatus === 'connected') {
      textInputRef.current?.focus();
      setResetInputFocus(false);
    }
  }, [resetInputFocus, connectionStatus]);

  const createNewSession = async () => {
    if (!aiAgentEnabled) {
      setError('You must configure your OpenRouter credentials to use the AI agent');
      return;
    }

    if (!snapshot) {
      setError('Snapshot ID is required to create a session');
      return;
    }

    try {
      await disconnect();
      await sleep(100);
      const { session, available_capabilities } = await createSession(snapshot.id);
      connect(session.id);

      setAvailableCapabilities(available_capabilities);
      // Preselect capabilities that have enabledByDefault=true
      const defaultCapabilities = available_capabilities
        .filter((cap: Capability) => cap.enabledByDefault)
        .map((cap: Capability) => cap.code);
      setSelectedCapabilities(defaultCapabilities);
      setError(null);
      setMessage('');
      setResetInputFocus(true);
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
      const selectedStyleGuides = styleGuides.filter((sg) => activeResources.includes(sg.id));

      const messageData: SendMessageRequestDTO = {
        message: message.trim(),
        model: activeModel,
      };

      // Include style guide content if selected
      if (selectedStyleGuides.length > 0) {
        messageData.style_guides = selectedStyleGuides.map((sg) => ({
          name: sg.name,
          content: sg.body,
        }));
      }

      // Include view ID if available
      if (currentView) {
        messageData.view_id = currentView.id;
      }

      // Include capabilities if selected
      if (selectedCapabilities.length > 0) {
        messageData.capabilities = selectedCapabilities;
      }

      // Include focused cells if available
      if (readFocus && readFocus.length > 0) {
        messageData.read_focus = readFocus;
      }

      if (writeFocus && writeFocus.length > 0) {
        messageData.write_focus = writeFocus;
      }

      if (activeTable) {
        messageData.active_table_id = activeTable.id.wsId;
      }

      if (dataScope) {
        messageData.data_scope = dataScope;
        messageData.record_id = activeRecordId;
        messageData.column_id = activeColumnId;
      }

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

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
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

  if (!rightPanelOpened) return null;

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

  const chatInputEnabled = aiAgentEnabled && activeSessionId && connectionStatus === 'connected' && !agentTaskRunning;

  const connectionBadge =
    connectionStatus === 'connected' ? (
      <Badge size="xs" variant="light" color="green" leftSection={<CellTowerIcon size={12} />}>
        Connected
      </Badge>
    ) : connectionStatus === 'connecting' ? (
      <Badge size="xs" variant="light" color="yellow" leftSection={<Loader size="xs" />}>
        Connecting...
      </Badge>
    ) : null;

  return (
    <SideBarContent>
      <SideBarContent.Header>
        <Group justify="space-between" align="center" wrap="nowrap" h="100%">
          <Group gap="2px">
            <ActionIcon onClick={toggleRightPanel} size="sm" variant="subtle" title="Close chat">
              <StyledIcon Icon={SidebarSimpleIcon} size={14} c="gray.7" />
            </ActionIcon>
            <TextTitleSm>
              {activeSession ? _.truncate(activeSession.name, { length: 20, omission: '...' }) : 'Agent Chat'}
            </TextTitleSm>
          </Group>
          <Group gap="xs">
            {connectionBadge}
            <Tooltip label="New chat">
              <ActionIcon
                onClick={createNewSession}
                size="sm"
                variant="subtle"
                title="New chat"
                disabled={!aiAgentEnabled}
              >
                <StyledIcon Icon={PlusIcon} size={14} />
              </ActionIcon>
            </Tooltip>
            <SessionHistorySelector
              disabled={!aiAgentEnabled}
              onSelect={async (sessionId: string) => {
                if (sessionId) {
                  await disconnect();
                  try {
                    await activateSession(sessionId);
                    await connect(sessionId);
                    setMessage('');
                    setResetInputFocus(true);
                  } catch (error) {
                    setError(`Failed to activate session: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                } else {
                  clearActiveSession();
                  await disconnect();
                }
                // Reset capabilities when switching sessions
                setAvailableCapabilities([]);
                setSelectedCapabilities([]);
              }}
            />
            <Tooltip label="Delete chat">
              <ActionIcon
                onClick={async () => {
                  if (!activeSessionId) return;
                  await disconnect();
                  await clearActiveSession();
                  await deleteSession(activeSessionId);
                }}
                size="sm"
                variant="subtle"
                title="Delete session"
                disabled={!activeSessionId}
              >
                <TrashIcon size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </SideBarContent.Header>
      <SideBarContent.Body>
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
          <Alert color="red" mb="sm" p="xs" title="Websocket error">
            <Text size="xs" c="dimmed">
              {connectionError}
            </Text>
          </Alert>
        )}

        {/* Messages */}

        {activeSessionId ? (
          <ScrollArea flex={1} viewportRef={scrollAreaRef}>
            <Stack gap="xs">
              {chatHistory.map((msg, index) => (
                <ChatMessageElement key={index} msg={msg} />
              ))}
            </Stack>
          </ScrollArea>
        ) : (
          <Center h="100%">
            {aiAgentEnabled ? (
              <Button
                variant="subtle"
                leftSection={<ChatCircleIcon size={16} />}
                onClick={createNewSession}
                size="xs"
                w="fit-content"
              >
                Start new chat
              </Button>
            ) : (
              <Stack gap="xs" justify="center" align="center">
                <Text size="xs" c="dimmed">
                  You must configure your OpenRouter credentials to use the AI agent
                </Text>
                <SecondaryButton component="a" href={RouteUrls.settingsPageUrl} size="xs" w="fit-content">
                  Configure credentials
                </SecondaryButton>
              </Stack>
            )}
          </Center>
        )}

        <Divider my="xs" />
        {/* Bottom Input Area */}
        <Stack gap="xs">
          {/* Style Guide Selection */}
          <ResourceSelector disabled={!aiAgentEnabled} />

          <ContextBadges activeTable={activeTable} currentView={currentView} />

          {/* Capabilities Selection */}
          {availableCapabilities.length > 0 && (
            <CapabilitiesPicker
              availableCapabilities={availableCapabilities}
              selectedCapabilities={selectedCapabilities}
              onCapabilitiesChange={setSelectedCapabilities}
            />
          )}

          {/* Input Area */}
          <Textarea
            ref={textInputRef}
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyUp={handleKeyPress}
            disabled={agentTaskRunning || !aiAgentEnabled}
            onFocus={() => {
              handleTextInputFocus();
            }}
            size="xs"
            minRows={5}
            maxRows={5}
            rows={5}
            autosize={false}
          />

          {/* Model and Submit Row */}
          <Group gap="xs" align="center">
            <Group gap="6px" style={{ flex: 1 }}>
              <Tooltip label="Browse LLM models">
                <ActionIcon
                  variant="subtle"
                  onClick={() => setShowModelSelector(true)}
                  size="sm"
                  disabled={!aiAgentEnabled}
                >
                  <StyledIcon Icon={HeadCircuitIcon} size={14} c="gray.9" />
                </ActionIcon>
              </Tooltip>
              <TextInput
                placeholder="Enter model name"
                value={activeModel}
                disabled={!aiAgentEnabled}
                onChange={(e) => setActiveModel(e.target.value)}
                size="xs"
                style={{ flex: 1 }}
                styles={{
                  input: {
                    padding: '0px',
                    border: 'none',
                    '&:focus': {
                      border: '1px solid #228be6',
                    },
                  },
                }}
              />
            </Group>
            <ActionIcon
              onClick={() => {
                if (runningAgentTaskId) {
                  cancelAgentRun(runningAgentTaskId);
                }
              }}
              size="md"
              variant="transparent"
              title="Cancel task"
              disabled={!runningAgentTaskId || !agentTaskRunning}
            >
              <StyledIcon Icon={StopCircleIcon} size={16} />
            </ActionIcon>
            <ActionIcon
              onClick={sendMessage}
              disabled={!message.trim() || !chatInputEnabled}
              loading={agentTaskRunning}
              size="md"
            >
              <PaperPlaneRightIcon size={16} />
            </ActionIcon>
          </Group>
        </Stack>

        {/* Model Selector Modal */}
        <Modal
          opened={showModelSelector}
          onClose={() => setShowModelSelector(false)}
          title="Select Model"
          size="xl"
          zIndex={1003}
        >
          <ModelPicker
            value={activeModel}
            onChange={(value) => {
              setActiveModel(value);
              setShowModelSelector(false);
            }}
          />
        </Modal>
      </SideBarContent.Body>
    </SideBarContent>
  );
}

export const ContextBadges = ({
  activeTable,
  currentView,
}: {
  activeTable: TableSpec | null;
  currentView: ColumnView | undefined;
}) => {
  const { dataScope, activeRecordId, activeColumnId } = useAgentChatContext();

  return (
    <Group gap="xs">
      <Group gap="xs">
        {activeTable && (
          <BadgeWithTooltip
            size="sm"
            color="purple"
            variant="outline"
            radius="sm"
            tooltip="The current table being viewed"
            leftSection={<TableIcon size={14} />}
          >
            {activeTable.name}
          </BadgeWithTooltip>
        )}
        {dataScope && (
          <BadgeWithTooltip
            size="sm"
            color="green"
            variant="outline"
            radius="sm"
            leftSection={<BinocularsIcon size={14} />}
            tooltip="The agent can work all active records in the table"
          >
            {dataScope}
          </BadgeWithTooltip>
        )}
        {dataScope === 'record' || dataScope === 'column' ? (
          <BadgeWithTooltip
            size="sm"
            color="blue"
            variant="outline"
            radius="sm"
            leftSection={<VinylRecordIcon size={14} />}
            tooltip="The agent is just working on this record"
          >
            {activeRecordId}
          </BadgeWithTooltip>
        ) : null}
        {dataScope === 'column' && (
          <BadgeWithTooltip
            size="sm"
            color="blue"
            variant="outline"
            radius="sm"
            leftSection={<TagSimpleIcon size={14} />}
            tooltip="The column being focused on by the agent"
          >
            {activeColumnId}
          </BadgeWithTooltip>
        )}
        {currentView && (
          <BadgeWithTooltip
            size="sm"
            color="green"
            variant="outline"
            radius="sm"
            leftSection={<EyeIcon size={14} />}
            tooltip="The active column view used by the agent"
          >
            {currentView.name || currentView.id}
          </BadgeWithTooltip>
        )}
      </Group>
    </Group>
  );
};
