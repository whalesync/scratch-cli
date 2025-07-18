'use client';

import { useStyleGuides } from '@/hooks/use-style-guide';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
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
import { ChatCircle, MagnifyingGlass, PaperPlaneRightIcon, Plus, X, XIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import CapabilitiesPicker from './CapabilitiesPicker';
import { MarkdownRenderer } from './markdown/MarkdownRenderer';
import ModelPicker from './ModelPicker';

interface ChatMessage {
  role: 'user' | 'assistant';
  message: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  name: string;
  chat_history: ChatMessage[];
  summary_history: Array<{
    requestSummary: string;
    responseSummary: string;
  }>;
  created_at: string;
  last_activity: string;
  snapshot_id?: string;
}

interface FocusedCell {
  recordWsId: string;
  columnWsId: string;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  snapshotId?: string;
  currentViewId?: string | null;
  readFocus?: FocusedCell[];
  writeFocus?: FocusedCell[];
}

interface AgentErrorResponse {
  detail: string;
}

const AI_CHAT_SERVER_URL = process.env.NEXT_PUBLIC_AI_CHAT_SERVER_URL || 'http://localhost:8000';

export default function AIChatPanel({
  isOpen,
  onClose,
  snapshotId,
  currentViewId,
  readFocus,
  writeFocus,
}: AIChatPanelProps) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<ChatSession | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [resetInputFocus, setResetInputFocus] = useState(false);
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4o-mini');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

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

  // Load sessions on mount
  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

  const loadSessions = async () => {
    if (isLoadingSessions) return; // Prevent multiple simultaneous loads

    setIsLoadingSessions(true);
    try {
      console.debug('Loading sessions from:', `${AI_CHAT_SERVER_URL}/sessions`);
      const response = await fetch(`${AI_CHAT_SERVER_URL}/sessions`);
      const data = await response.json();
      console.debug('Sessions response:', data);
      setSessions(data.sessions);
      console.debug('Set sessions:', data.sessions);
    } catch (error) {
      setError('Failed to load sessions');
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${AI_CHAT_SERVER_URL}/sessions/${sessionId}`);
      if (response.ok) {
        const data = (await response.json()) as ChatSession;
        setSessionData(data);
        scrollToBottom();
      } else {
        setError('Failed to load session');
      }
    } catch (error) {
      setError('Failed to load session');
      console.error('Error loading session:', error);
    }
  };

  useEffect(() => {
    if (currentSessionId) {
      loadSession(currentSessionId);
    }
  }, [currentSessionId]);

  const createNewSession = async () => {
    if (!snapshotId) {
      setError('Snapshot ID is required to create a session');
      return;
    }

    try {
      const url = new URL(`${AI_CHAT_SERVER_URL}/sessions`);
      url.searchParams.append('snapshot_id', snapshotId);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSessions((prev) => [...prev, data.session]);
        setCurrentSessionId(data.session.id);
        setAvailableCapabilities(data.available_capabilities);
        // Preselect capabilities that have enabledByDefault=true
        const defaultCapabilities = data.available_capabilities
          .filter((cap: Capability) => cap.enabledByDefault)
          .map((cap: Capability) => cap.code);
        setSelectedCapabilities(defaultCapabilities);
        setError(null);
        console.debug('Created new session with snapshot ID:', snapshotId);
        console.debug('Available capabilities:', data.available_capabilities);
        console.debug('Default selected capabilities:', defaultCapabilities);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(`Failed to create session: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      setError('Failed to create session');
      console.error('Error creating session:', error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${AI_CHAT_SERVER_URL}/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSessions((prev) => prev.filter((session) => session.id !== sessionId));
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setSessionData(null);
        }
        setError(null);
      } else {
        setError('Failed to delete session');
      }
    } catch (error) {
      setError('Failed to delete session');
      console.error('Error deleting session:', error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !currentSessionId || isLoading) return;

    // Optimistically update chat history
    if (sessionData) {
      const optimisticMessage = {
        role: 'user' as const,
        message: message.trim(),
        timestamp: new Date().toISOString(),
      };
      setSessionData({
        ...sessionData,
        chat_history: [...sessionData.chat_history, optimisticMessage],
      });
      scrollToBottom();
    }

    setIsLoading(true);
    setError(null);

    console.debug('Message data:', {
      message: message.trim(),
      currentSessionId,
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
        style_guides?: string[];
        capabilities?: string[];
        model?: string;
        view_id?: string;
        read_focus?: FocusedCell[];
        write_focus?: FocusedCell[];
      } = {
        message: message.trim(),
        model: selectedModel,
      };

      // Include API token if available
      if (user?.apiToken) {
        messageData.api_token = user.apiToken;
        console.debug('Including API token in request');
      } else {
        console.debug('No API token available');
      }

      // Include style guide content if selected
      if (selectedStyleGuides.length > 0) {
        messageData.style_guides = selectedStyleGuides.map((sg) => sg.body);
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

      const response = await fetch(`${AI_CHAT_SERVER_URL}/sessions/${currentSessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      if (response.ok) {
        setMessage('');

        // Reload session to get updated history
        await loadSession(currentSessionId);
        console.debug('Message sent successfully, reloaded session');
      } else {
        setError('Failed to send message');
        const errorText = (await response.json()) as AgentErrorResponse;
        setErrorDetails(errorText.detail);
        console.error('Error from agent server: ', errorText.detail);
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
          value={currentSessionId}
          onChange={(value) => {
            console.debug('Select onChange called with:', value);
            setCurrentSessionId(value);
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
          <Plus size={14} />
        </ActionIcon>
        {currentSessionId && (
          <ActionIcon
            onClick={() => deleteSession(currentSessionId)}
            size="sm"
            variant="subtle"
            color="red"
            title="Delete session"
          >
            <X size={14} />
          </ActionIcon>
        )}
      </Group>

      {/* Debug info */}
      <Text size="xs" c="dimmed" mb="xs">
        Sessions: {sessions.length} | Current: {currentSessionId || 'none'} | Model: {selectedModel}
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
        {currentSessionId ? (
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
          disabled={isLoading || !currentSessionId}
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
                if (currentSessionId && !isLoading) {
                  sendMessage();
                }
              }, 0);
            }}
            disabled={isLoading || !currentSessionId}
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
            disabled={!message.trim() || isLoading || !currentSessionId}
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
