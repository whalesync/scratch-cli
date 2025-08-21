'use client';

import { useFocusedCellsContext } from '@/app/snapshots/[...slug]/FocusedCellsContext';
import { useAIAgentSessionManagerContext } from '@/contexts/ai-agent-session-manager-context';
import { AgentProgressMessageData, useAIAgentChatWebSocket, WebSocketMessage } from '@/hooks/use-agent-chat-websocket';
import { useStyleGuides } from '@/hooks/use-style-guide';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { Capability, SendMessageRequestDTO } from '@/types/server-entities/chat-session';
import { TableSpec } from '@/types/server-entities/snapshot';
import { sleep } from '@/utils/helpers';
import {
  ActionIcon,
  Alert,
  Badge,
  Center,
  CloseButton,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import {
  BinocularsIcon,
  CellTowerIcon,
  ChatCircleIcon,
  EyeIcon,
  HeadCircuitIcon,
  PaperPlaneRightIcon,
  PlusIcon,
  StopCircleIcon,
  TableIcon,
  TagSimpleIcon,
  TrashIcon,
  VinylRecordIcon,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAIPromptContext } from '../../snapshots/[...slug]/AIPromptContext';
import { useSnapshotContext } from '../../snapshots/[...slug]/SnapshotContext';
import { BadgeWithTooltip } from '../BadgeWithTooltip';
import { TextTitleSm } from '../base/text';
import { StyledIcon } from '../Icons/StyledIcon';
import ModelPicker from '../ModelPicker';
import { ResourceSelector } from '../ResourceSelector';
import CapabilitiesPicker from './CapabilitiesPicker';
import { ChatMessageElement } from './ChatMessageElement';

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTable: TableSpec | null;
}

export default function AIChatPanel({ isOpen, onClose, activeTable }: AIChatPanelProps) {
  const { snapshot, currentView } = useSnapshotContext();

  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [resetInputFocus, setResetInputFocus] = useState(false);
  const [selectedModel, setSelectedModel] = useLocalStorage({
    key: 'selectedModel',
    defaultValue: 'openai/gpt-4o-mini',
  });
  const [showModelSelector, setShowModelSelector] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const { readFocus, writeFocus, dataScope, activeRecordId, activeColumnId } = useFocusedCellsContext();
  const { promptQueue, clearPromptQueue } = useAIPromptContext();
  const [agentTaskRunning, setAgentTaskRunning] = useState<boolean>(false);
  const [runningAgentTaskId, setRunningAgentTaskId] = useState<string | null>(null);

  // Get user data including API token
  const { user } = useScratchPadUser();
  const { styleGuides } = useStyleGuides();
  const [selectedStyleGuideIds, setSelectedStyleGuideIds] = useLocalStorage<string[]>({
    key: `selectedStyleGuideIds-${snapshot?.id}`,
    defaultValue: [],
  });
  const [autoIncludedResourses, setAutoIncludedResourses] = useState<boolean>(false);
  const [availableCapabilities, setAvailableCapabilities] = useState<Capability[]>([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [scrollAreaRef]);

  const {
    sessions,
    activeSessionId,
    activeSession: sessionData,
    createSession,
    deleteSession,
    activateSession,
    clearActiveSession,
    cancelAgentRun,
  } = useAIAgentSessionManagerContext();

  const handleWebsocketMessage = useCallback(
    (message: WebSocketMessage) => {
      // this is just to handle some flow control for the UI.
      // The hook already tracks the message history and we can use that for the UI
      if (message.type === 'message_progress') {
        console.debug('Message progress:', message.data);
        const payload = message.data as AgentProgressMessageData;
        if (payload.progress_type === 'run_started') {
          setRunningAgentTaskId(payload.payload['run_id'] as string);
        }
      } else if (message.type === 'message_response') {
        console.debug('Message response:', message.data);
        setAgentTaskRunning(false);
        setRunningAgentTaskId(null);
        setResetInputFocus(true);
      } else if (message.type === 'agent_error') {
        setAgentTaskRunning(false);
        setRunningAgentTaskId(null);
        setResetInputFocus(true);
      }
      // got a message, try to scroll to the bottom
      scrollToBottom();
    },
    [scrollToBottom],
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
    if (sessionData?.chat_history && sessionData.chat_history.length > 0) {
      scrollToBottom();
    }
  }, [sessionData?.chat_history, scrollToBottom]);

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

  useEffect(() => {
    if (promptQueue.length > 0) {
      setMessage(message + '\n' + promptQueue.join('\n'));
      clearPromptQueue();
    }
  }, [promptQueue, clearPromptQueue, message]);

  useEffect(() => {
    if (!autoIncludedResourses && styleGuides.length > 0) {
      const autoIncludeStyleGuides = styleGuides
        .filter((sg) => sg.autoInclude && !selectedStyleGuideIds.includes(sg.id))
        .map((sg) => sg.id);
      if (autoIncludeStyleGuides.length > 0) {
        setSelectedStyleGuideIds([...selectedStyleGuideIds, ...autoIncludeStyleGuides]);
        setAutoIncludedResourses(true);
      }
    }
  }, [styleGuides, autoIncludedResourses, selectedStyleGuideIds, setSelectedStyleGuideIds]);

  const createNewSession = async () => {
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
      console.debug('Created new session with snapshot ID:', snapshot.id);
      console.debug('Available capabilities:', available_capabilities);
      console.debug('Default selected capabilities:', defaultCapabilities);
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
      const selectedStyleGuides = styleGuides.filter((sg) => selectedStyleGuideIds.includes(sg.id));

      const messageData: SendMessageRequestDTO = {
        message: message.trim(),
        model: selectedModel,
      };

      // Include API token if available
      if (user?.agentToken) {
        messageData.api_token = user?.agentToken;
      }

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
        console.debug('Including capabilities:', selectedCapabilities.join(', '));
      }

      // Include focused cells if available
      if (readFocus && readFocus.length > 0) {
        messageData.read_focus = readFocus;
        console.debug('Including read focus:', readFocus.length, 'cells');
      }

      if (writeFocus && writeFocus.length > 0) {
        messageData.write_focus = writeFocus;
        console.debug('Including write focus:', writeFocus.length, 'cells');
      }

      if (activeTable) {
        messageData.active_table_id = activeTable.id.wsId;
        console.debug('Including active table ID:', activeTable.id.wsId);
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

  if (!isOpen) return null;

  // combine the historical session data and the current websocket message history
  const chatHistory = [...(sessionData?.chat_history || []), ...(messageHistory || [])];

  const chatInputEnabled = activeSessionId && connectionStatus === 'connected' && !agentTaskRunning;

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
    <Paper
      p="xs"
      bg="transparent"
      h="100%"
      w="30%"
      miw="300px"
      maw="600px"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible',
        borderLeft: '1px solid var(--mantine-color-gray-2)',
        borderRadius: '0px',
      }}
    >
      {/* Header */}
      <Group justify="space-between" mb="md" h="50px">
        <Group justify="space-between" style={{ flex: 1 }}>
          <TextTitleSm>Agent Chat</TextTitleSm>
          {connectionBadge}
        </Group>
        <CloseButton onClick={onClose} size="sm" />
      </Group>

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

      {/* Session Management */}
      <Group mb="md" gap="xs" style={{}}>
        <Select
          placeholder="Select session"
          value={activeSessionId}
          onChange={async (value) => {
            if (value) {
              await disconnect();
              try {
                await activateSession(value);
                await connect(value);
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
          data={sessions.map((session) => ({
            value: session.id,
            label: session.name,
          }))}
          size="xs"
          style={{ flex: 1 }}
          searchable={false}
          clearable={false}
          allowDeselect={true}
          maxDropdownHeight={200}
          styles={{
            dropdown: {
              zIndex: 1002,
            },
          }}
        />
        <ActionIcon onClick={createNewSession} size="sm" variant="subtle" title="New chat">
          <PlusIcon size={14} />
        </ActionIcon>
        <ActionIcon
          onClick={async () => {
            if (!activeSessionId) return;
            await disconnect();
            await clearActiveSession();
            await deleteSession(activeSessionId);
          }}
          size="sm"
          variant="subtle"
          color="red"
          title="Delete session"
          disabled={!activeSessionId}
        >
          <TrashIcon size={14} />
        </ActionIcon>
      </Group>

      {/* Messages */}

      {activeSessionId ? (
        <ScrollArea flex={1} viewportRef={scrollAreaRef} mb="md">
          <Stack gap="xs">
            {chatHistory.map((msg, index) => (
              <ChatMessageElement key={index} msg={msg} />
            ))}
          </Stack>
        </ScrollArea>
      ) : (
        <Center h="100%">
          <Group gap="xs" align="center">
            <ChatCircleIcon size={16} color="gray.5" />
            <TextTitleSm>Select a session or create a new one to start working with the AI</TextTitleSm>
          </Group>
        </Center>
      )}

      <Divider />
      {/* Bottom Input Area */}
      <Stack gap="xs">
        {/* Style Guide Selection */}
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            Resources:
          </Text>
          <ResourceSelector
            selectedStyleGuideIds={selectedStyleGuideIds}
            setSelectedStyleGuideIds={setSelectedStyleGuideIds}
          />
        </Group>

        {/* Capabilities Selection */}
        {availableCapabilities.length > 0 && (
          <CapabilitiesPicker
            availableCapabilities={availableCapabilities}
            selectedCapabilities={selectedCapabilities}
            onCapabilitiesChange={setSelectedCapabilities}
          />
        )}

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

        {/* Input Area */}
        <Textarea
          ref={textInputRef}
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyUp={handleKeyPress}
          disabled={!chatInputEnabled}
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
              <ActionIcon variant="subtle" onClick={() => setShowModelSelector(true)} size="sm">
                <StyledIcon Icon={HeadCircuitIcon} size={14} c="gray.9" />
              </ActionIcon>
            </Tooltip>
            <TextInput
              placeholder="Enter model name"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
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
          value={selectedModel}
          onChange={(value) => {
            setSelectedModel(value);
            setShowModelSelector(false);
          }}
        />
      </Modal>
    </Paper>
  );
}
