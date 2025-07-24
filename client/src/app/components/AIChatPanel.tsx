'use client';

import { useFocusedCellsContext } from '@/app/snapshots/[id]/FocusedCellsContext';
import { useAIAgentSessionManagerContext } from '@/contexts/ai-agent-session-manager-context';
import { useStyleGuides } from '@/hooks/use-style-guide';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { aiAgentApi } from '@/lib/api/ai-agent';
import { Capability, ChatSessionSummary } from '@/types/server-entities/chat-session';
import {
  ActionIcon,
  Alert,
  Box,
  Group,
  Modal,
  MultiSelect,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { ChatCircle, MagnifyingGlass, PaperPlaneRightIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAIPromptContext } from '../snapshots/[id]/AIPromptContext';
import CapabilitiesPicker from './CapabilitiesPicker';
import { MarkdownRenderer } from './markdown/MarkdownRenderer';
import ModelPicker from './ModelPicker';

interface FocusedCell {
  recordWsId: string;
  columnWsId: string;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  snapshotId?: string;
  currentViewId?: string | null;
}

export default function AIChatPanel({ isOpen, onClose, snapshotId, currentViewId }: AIChatPanelProps) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [resetInputFocus, setResetInputFocus] = useState(false);
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4o-mini');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const { readFocus, writeFocus } = useFocusedCellsContext();
  const { promptQueue, clearPromptQueue } = useAIPromptContext();

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
    refreshActiveSession,
    addToActiveChatHistory,
    activateSession,
    clearActiveSession,
  } = useAIAgentSessionManagerContext();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (sessionData?.chat_history && sessionData.chat_history.length > 0) {
      scrollToBottom();
    }
  }, [sessionData?.chat_history, scrollToBottom]);

  useEffect(() => {
    if (resetInputFocus) {
      textInputRef.current?.focus();
      setResetInputFocus(false);
    }
  }, [resetInputFocus]);

  useEffect(() => {
    if (promptQueue.length > 0) {
      setMessage(message + '\n' + promptQueue.join('\n'));
      clearPromptQueue();
    }
  }, [promptQueue, clearPromptQueue, message]);

  const reloadSession = async () => {
    try {
      await refreshActiveSession();
      scrollToBottom();
    } catch (error) {
      setError('Failed to load session');
      console.error('Error loading session:', error);
    }
  };

  const createNewSession = async () => {
    if (!snapshotId) {
      setError('Snapshot ID is required to create a session');
      return;
    }

    try {
      const { available_capabilities } = await createSession(snapshotId);

      setAvailableCapabilities(available_capabilities);
      // Preselect capabilities that have enabledByDefault=true
      const defaultCapabilities = available_capabilities
        .filter((cap: Capability) => cap.enabledByDefault)
        .map((cap: Capability) => cap.code);
      setSelectedCapabilities(defaultCapabilities);
      setError(null);
      console.debug('Created new session with snapshot ID:', snapshotId);
      console.debug('Available capabilities:', available_capabilities);
      console.debug('Default selected capabilities:', defaultCapabilities);
    } catch (error) {
      setError(`Failed to create session: ${error}}`);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !activeSessionId || isLoading) return;

    // Optimistically update chat history
    if (sessionData) {
      const optimisticMessage = {
        role: 'user' as const,
        message: message.trim(),
        timestamp: new Date().toISOString(),
      };
      addToActiveChatHistory(optimisticMessage);
      scrollToBottom();
    }

    setIsLoading(true);
    setError(null);

    console.debug('Message data:', {
      message: message.trim(),
      activeSessionId,
      historyLength: sessionData?.chat_history.length || 0,
      hasApiToken: !!user?.apiToken,
      snapshotId: snapshotId,
    });

    try {
      // Get selected style guide content
      const selectedStyleGuides = styleGuides.filter((sg) => selectedStyleGuideIds.includes(sg.id));

      const messageData: {
        message: string;
        api_token?: string;
        style_guides?: Array<{ name: string; content: string }>;
        capabilities?: string[];
        model?: string;
        view_id?: string;
        read_focus?: FocusedCell[];
        write_focus?: FocusedCell[];
      } = {
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

      const response = await aiAgentApi.sendMessage(activeSessionId, JSON.stringify(messageData));

      if (response.type === 'agent_error') {
        setError('Failed to send message');
        setErrorDetails(response.detail);
      } else {
        setMessage('');
        // Reload session to get updated history
        await reloadSession();
      }
    } catch (error) {
      setError('Failed to send agent message');
      setErrorDetails(error instanceof Error ? error.message : 'Unknown error');
      console.error('Exception while sending message:', error);
    } finally {
      setIsLoading(false);
      setResetInputFocus(true);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const formatSessionLabel = (session: ChatSessionSummary) => {
    return session.name;
    // const date = new Date(parseInt(sessionId.split('_')[1]));
    // return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  if (!isOpen) return null;

  return (
    <Paper
      shadow="md"
      p="md"
      style={{
        width: '30%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible',
      }}
    >
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Text fw={500} size="sm">
          AI Chat
          {snapshotId && (
            <Text span size="xs" c="dimmed" ml="xs">
              (Snapshot: {snapshotId.slice(0, 8)}...)
            </Text>
          )}
        </Text>
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

      {/* Session Management */}
      <Group mb="md" gap="xs" style={{}}>
        <Select
          placeholder="Select session"
          value={activeSessionId}
          onChange={(value) => {
            if (value) {
              activateSession(value);
            } else {
              clearActiveSession();
            }
            // Reset capabilities when switching sessions
            setAvailableCapabilities([]);
            setSelectedCapabilities([]);
          }}
          data={sessions.map((session) => ({
            value: session.id,
            label: formatSessionLabel(session),
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
            onClick={() => deleteSession(activeSessionId)}
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
      <Text size="xs" c="dimmed" mb="xs">
        Sessions: {sessions.length} | Current: {activeSessionId || 'none'} | Model: {selectedModel}
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
      </Text>

      {/* Messages */}
      <ScrollArea flex={1} viewportRef={scrollAreaRef} mb="md">
        {activeSessionId ? (
          <Stack gap="xs">
            {sessionData?.chat_history.map((msg, index) => (
              <Paper
                key={index}
                p="xs"
                bg={msg.role === 'user' ? 'blue.0' : 'gray.0'}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '90%',
                }}
              >
                <Stack gap="xs">
                  {msg.role === 'user' ? (
                    <Text size="xs">{msg.message}</Text>
                  ) : (
                    <Box fz="xs">
                      <MarkdownRenderer>{msg.message}</MarkdownRenderer>
                    </Box>
                  )}
                  <Text size="xs" c="dimmed">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </Text>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Stack align="center" justify="center" h="100%">
            <ChatCircle size={32} color="#00A2E9" />
            <Text size="sm" fw={500} ta="center">
              Select a session or create a new one to start chatting
            </Text>
          </Stack>
        )}
      </ScrollArea>

      {/* Bottom Input Area */}
      <Stack gap="xs">
        {/* Style Guide Selection */}
        <MultiSelect
          placeholder={selectedStyleGuideIds.length === 0 ? 'Select style guides (optional)' : ''}
          value={selectedStyleGuideIds}
          onChange={setSelectedStyleGuideIds}
          data={styleGuides.map((styleGuide) => ({
            value: styleGuide.id,
            label: styleGuide.name,
          }))}
          size="xs"
          searchable={false}
          clearable={false}
          maxDropdownHeight={200}
          comboboxProps={{ position: 'top', middlewares: { flip: false, shift: false } }}
          styles={{
            input: {
              border: 'none',
              backgroundColor: 'transparent',
              paddingLeft: '0px',
            },
          }}
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
          disabled={isLoading || !activeSessionId}
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
              <MagnifyingGlass size={14} />
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
                if (activeSessionId && !isLoading) {
                  sendMessage();
                }
              }, 0);
            }}
            disabled={isLoading || !activeSessionId}
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
            disabled={!message.trim() || isLoading || !activeSessionId}
            loading={isLoading}
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
