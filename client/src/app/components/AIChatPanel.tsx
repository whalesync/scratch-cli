'use client';

import { useFocusedCellsContext } from '@/app/snapshots/[id]/FocusedCellsContext';
import { useAIAgentSessionManagerContext } from '@/contexts/ai-agent-session-manager-context';
import { useAIAgentChatWebSocket, WebSocketMessage } from '@/hooks/use-agent-chat-websocket';
import { useStyleGuides } from '@/hooks/use-style-guide';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { Capability, ChatMessage, SendMessageRequestDTO } from '@/types/server-entities/chat-session';
import { Snapshot, TableSpec } from '@/types/server-entities/snapshot';
import { sleep } from '@/utils/helpers';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import {
  BinocularsIcon,
  ChatCircleIcon,
  MagnifyingGlassIcon,
  PaperPlaneRightIcon,
  PlusIcon,
  TableIcon,
  TagSimpleIcon,
  VinylRecordIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAIPromptContext } from '../snapshots/[id]/AIPromptContext';
import { BadgeWithTooltip } from './BadgeWithTooltip';
import CapabilitiesPicker from './CapabilitiesPicker';
import { MarkdownRenderer } from './markdown/MarkdownRenderer';
import ModelPicker from './ModelPicker';
import { ResourceSelector } from './ResourceSelector';

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot?: Snapshot;
  activeTable: TableSpec | null;
  currentViewId?: string | null;
}

export default function AIChatPanel({ isOpen, onClose, snapshot, currentViewId, activeTable }: AIChatPanelProps) {
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

  // Get user data including API token
  const { user } = useScratchPadUser();
  const { styleGuides } = useStyleGuides();
  const [selectedStyleGuideIds, setSelectedStyleGuideIds] = useState<string[]>([]);
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
  } = useAIAgentSessionManagerContext();

  const handleWebsocketMessage = useCallback(
    (message: WebSocketMessage) => {
      // this is just to handle some flow control for the UI.
      // The hook already tracks the message history and we can use that for the UI
      if (message.type === 'message_progress') {
        console.debug('Message progress:', message.data);
      } else if (message.type === 'message_response') {
        console.debug('Message response:', message.data);
        setAgentTaskRunning(false);
        setResetInputFocus(true);
      } else if (message.type === 'agent_error') {
        setAgentTaskRunning(false);
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

      const apiToken = user?.agentToken || user?.apiToken;
      // Include API token if available
      if (apiToken) {
        messageData.api_token = user.apiToken;
      }

      // Include style guide content if selected
      if (selectedStyleGuides.length > 0) {
        messageData.style_guides = selectedStyleGuides.map((sg) => ({
          name: sg.name,
          content: sg.body,
        }));
        console.debug('Including style guides:', selectedStyleGuides.map((sg) => sg.name).join(', '));
      }

      // Include view ID if available
      if (currentViewId) {
        messageData.view_id = currentViewId;
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
      <Badge size="xs" color="green">
        Connected
      </Badge>
    ) : connectionStatus === 'connecting' ? (
      <Badge size="xs" color="yellow">
        Connecting...
      </Badge>
    ) : (
      <Badge size="xs" color="grey">
        Offline
      </Badge>
    );

  return (
    <Paper
      shadow="md"
      p="md"
      style={{
        width: '30%',
        height: '99%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible',
      }}
    >
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <Text fw={500} size="sm">
            AI Chat
          </Text>
        </Group>
        <ActionIcon onClick={onClose} size="sm" variant="subtle">
          <XIcon size={16} />
        </ActionIcon>
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
          style={{ flex: 1, zIndex: 1001 }}
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
        {activeSessionId && (
          <ActionIcon
            onClick={async () => {
              await disconnect();
              await clearActiveSession();
              await deleteSession(activeSessionId);
            }}
            size="sm"
            variant="subtle"
            color="red"
            title="Delete session"
          >
            <XIcon size={14} />
          </ActionIcon>
        )}
      </Group>

      {/* Debug info */}
      <Group align="center" gap="4px" mb="xs">
        <Text size="xs" c="dimmed">
          Sessions: {sessions.length} | Current: {activeSessionId || 'none'}
        </Text>
        <Text size="xs" c="dimmed">
          Model: {selectedModel}
        </Text>
        {connectionBadge}

        {currentViewId && (
          <Text span size="xs" c="green" ml="xs">
            | View: {currentViewId.slice(0, 8)}...
          </Text>
        )}

        {selectedStyleGuideIds.length > 0 && (
          <Text span size="xs" c="blue" ml="xs">
            | Style Guides ({selectedStyleGuideIds.length}):{' '}
            {selectedStyleGuideIds
              .map((id) => styleGuides.find((sg) => sg.id === id)?.name)
              .filter(Boolean)
              .join(', ')}
          </Text>
        )}
        {selectedCapabilities.length > 0 && (
          <Text span size="xs" c="purple" ml="xs">
            | Capabilities ({selectedCapabilities.length}): {selectedCapabilities.join(', ')}
          </Text>
        )}
      </Group>

      {/* Messages */}
      <ScrollArea flex={1} viewportRef={scrollAreaRef} mb="md">
        {activeSessionId ? (
          <Stack gap="xs">
            {chatHistory.map((msg, index) => (
              <ChatMessageElement key={index} msg={msg} />
            ))}
          </Stack>
        ) : (
          <Stack align="center" justify="center" h="100%">
            <ChatCircleIcon size={32} color="#00A2E9" />
            <Text size="sm" fw={500} ta="center">
              Select a session or create a new one to start chatting
            </Text>
          </Stack>
        )}
      </ScrollArea>

      <Group gap="xs">
        <Text size="xs" c="dimmed">
          Context:
        </Text>
        {activeTable && (
          <BadgeWithTooltip
            size="xs"
            color="purple"
            variant="outline"
            radius="sm"
            tooltip="The current table being viewed"
            leftSection={<TableIcon size={12} />}
          >
            {activeTable.name}
          </BadgeWithTooltip>
        )}
        {dataScope && (
          <BadgeWithTooltip
            size="xs"
            color="green"
            variant="outline"
            radius="sm"
            leftSection={<BinocularsIcon size={12} />}
            tooltip="The current scope of the AI context"
          >
            {dataScope}
          </BadgeWithTooltip>
        )}
        {dataScope === 'record' || dataScope === 'column' ? (
          <BadgeWithTooltip
            size="xs"
            color="blue"
            variant="outline"
            radius="sm"
            leftSection={<VinylRecordIcon size={12} />}
            tooltip="The record being focused on in the AI context"
          >
            {activeRecordId}
          </BadgeWithTooltip>
        ) : null}
        {dataScope === 'column' && (
          <BadgeWithTooltip
            size="xs"
            color="blue"
            variant="outline"
            radius="sm"
            leftSection={<TagSimpleIcon size={12} />}
            tooltip="The column being focused on in the AI context"
          >
            {activeColumnId}
          </BadgeWithTooltip>
        )}
      </Group>

      {/* Bottom Input Area */}
      <Stack gap="xs">
        {/* Style Guide Selection */}
        <ResourceSelector
          selectedStyleGuideIds={selectedStyleGuideIds}
          setSelectedStyleGuideIds={setSelectedStyleGuideIds}
        />

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
          disabled={!chatInputEnabled}
          size="xs"
          minRows={5}
          maxRows={5}
          rows={5}
          autosize={false}
        />

        {/* Model and Submit Row */}
        <Group gap="xs" align="center">
          <Group gap="xs" style={{ flex: 1 }}>
            <ActionIcon
              onClick={() => setShowModelSelector(true)}
              size="sm"
              variant="subtle"
              title="Browse models"
              style={{
                color: '#ccc',
                backgroundColor: 'transparent',
              }}
            >
              <MagnifyingGlassIcon size={14} />
            </ActionIcon>
            <TextInput
              placeholder="Model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              size="xs"
              style={{ flex: 1 }}
              styles={{
                input: {
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
              setMessage('update');
              // Trigger send after setting the message
              setTimeout(() => {
                if (activeSessionId && !agentTaskRunning) {
                  sendMessage();
                }
              }, 0);
            }}
            disabled={!chatInputEnabled}
            size="sm"
            variant="light"
            color="blue"
            title="Send 'update' message"
          >
            <Text size="xs" fw={500}>
              update
            </Text>
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

const ChatMessageElement = ({ msg }: { msg: ChatMessage }) => {
  const bgColor = msg.role === 'user' ? 'blue.0' : 'gray.0';
  const borderColor = msg.variant === 'error' ? '1px solid red' : '1px solid transparent';
  const alignment = msg.role === 'user' ? 'flex-end' : 'flex-start';

  let content = null;
  if (msg.role === 'user') {
    content = <Text size="xs">{msg.message}</Text>;
  } else if (msg.variant === 'progress') {
    content = <Text size="xs">🧠... {msg.message}</Text>;
  } else {
    content = (
      <Box fz="xs">
        <MarkdownRenderer>{msg.message}</MarkdownRenderer>
      </Box>
    );
  }

  return (
    <Paper
      p="xs"
      bg={bgColor}
      bd={borderColor}
      style={{
        alignSelf: alignment,
        maxWidth: '90%',
      }}
    >
      <Stack gap="6px">
        {content}
        <Text c="dimmed" fz="8px">
          {new Date(msg.timestamp).toLocaleTimeString()}
        </Text>
      </Stack>
    </Paper>
  );
};
