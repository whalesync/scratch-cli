'use client';

import { AdvancedAgentInput } from '@/app/components/AdvancedAgentInput/AdvancedAgentInput';
import { Command } from '@/app/components/AdvancedAgentInput/CommandSuggestions';
import { ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import SideBarContent from '@/app/components/layouts/SideBarContent';
import { useAgentChatContext } from '@/app/snapshots/[...slug]/components/contexts/agent-chat-context';
import { useAIAgentSessionManagerContext } from '@/contexts/ai-agent-session-manager-context';
import {
  AgentProgressMessageData,
  SendMessageRequestDTO,
  useAIAgentChatWebSocket,
  WebSocketMessage,
} from '@/hooks/use-agent-chat-websocket';
import { useAgentCredentials } from '@/hooks/use-agent-credentials';
import { useStyleGuides } from '@/hooks/use-style-guide';
import {
  trackChangeAgentCapabilities,
  trackChangeAgentModel,
  trackOpenOldChatSession,
  trackSendMessage,
  trackStartAgentSession,
} from '@/lib/posthog';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { Capability } from '@/types/server-entities/chat-session';
import { SnapshotTable } from '@/types/server-entities/snapshot';
import { sleep } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import { ActionIcon, Alert, Box, Button, Center, Group, Modal, Stack, Text, Tooltip } from '@mantine/core';
import _ from 'lodash';
import {
  ChevronDownIcon,
  LucideFileKey,
  OctagonMinusIcon,
  PanelRightIcon,
  Plus,
  SendIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TextTitle3, TextXsRegular } from '../../../../components/base/text';
import ModelPicker from '../../../../components/ModelPicker';
import { useSnapshotContext } from '../contexts/SnapshotContext';
import { PublishConfirmationModal } from '../snapshot-grid/modals/PublishConfirmationModal';
import CapabilitiesButton from './CapabilitiesButton';
import CapabilitiesModal from './CapabilitiesModal';
import { ChatMessageElement } from './ChatMessageElement';
import { ContextBadges } from './ContextBadges';
import { ResourceSelector } from './ResourceSelector';
import { SessionHistorySelector } from './SessionHistorySelector';

interface AIChatPanelProps {
  activeTable: SnapshotTable | null;
}
const availableCapabilities = [
  {
    code: 'data:create',
    enabledByDefault: true,
    description: 'Create new records for a table in the active snapshot using data provided by the LLM.',
  },
  {
    code: 'data:update',
    enabledByDefault: true,
    description: 'Update existing records in a table in the active snapshot (creates suggestions, not direct changes).',
  },
  {
    code: 'data:delete',
    enabledByDefault: true,
    description: 'Delete records from a table in the active snapshot by their IDs.',
  },
  { code: 'data:field-tools', enabledByDefault: true, description: 'Tools to edit specific fields' },

  {
    code: 'data:fetch-tools',
    enabledByDefault: true,
    description: 'Tools for loading additional records from different tables and views into the context.',
  },
  {
    code: 'views:filtering',
    enabledByDefault: true,
    description: 'Set or clear SQL-based filters on tables to show/hide specific records.',
  },
  {
    code: 'table:add-column',
    enabledByDefault: false,
    description: 'Add scratch columns to the active table.',
  },
  {
    code: 'table:remove-column',
    enabledByDefault: false,
    description: 'Remove scratch columns from the active table.',
  },
  {
    code: 'other:url-content-load',
    enabledByDefault: false,
    description: 'Allows the LLM to load content from a URL and use it in the conversation.',
  },
  {
    code: 'other:upload-content',
    enabledByDefault: false,
    description: 'Allows the LLM to upload content to the active snapshot.',
  },
];

export default function AIChatPanel({ activeTable }: AIChatPanelProps) {
  const { snapshot, currentView, publish } = useSnapshotContext();
  const { rightPanelOpened, toggleRightPanel } = useLayoutManagerStore();
  const { activeOpenRouterCredentials } = useAgentCredentials();

  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [resetInputFocus, setResetInputFocus] = useState(false);
  const [showDeleteSessionButton, setShowDeleteSessionButton] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [showPublishConfirmation, setShowPublishConfirmation] = useState(false);
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

  const { styleGuides } = useStyleGuides();

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
        alert('TODO: Revert last action');
      },
    },
  ];

  // const [availableCapabilities, setAvailableCapabilities] = useState<Capability[]>([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);

  const { aiAgentEnabled } = useAgentCredentials();

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
        const defaultCapabilities = availableCapabilities
          .filter((cap: Capability) => cap.enabledByDefault)
          .map((cap: Capability) => cap.code);
        setSelectedCapabilities(defaultCapabilities);
      }
    } else {
      // No saved capabilities, use defaults
      const defaultCapabilities = availableCapabilities
        .filter((cap: Capability) => cap.enabledByDefault)
        .map((cap: Capability) => cap.code);
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
      const { session } = await createSession(snapshot.id);
      connect(session.id);
      // setAvailableCapabilities(available_capabilities);
      // Preselect capabilities that have enabledByDefault=true
      trackStartAgentSession(snapshot);
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
      const selectedStyleGuides = styleGuides.filter((sg) => activeResources.includes(sg.id));

      const messageData: SendMessageRequestDTO = {
        message: message.trim(),
        model: activeModel,
        credential_id: activeOpenRouterCredentials?.id,
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

      if (activeTable) {
        messageData.active_table_id = activeTable.tableSpec.id.wsId;
      }

      if (dataScope) {
        messageData.data_scope = dataScope;
        messageData.record_id = activeRecordId;
        messageData.column_id = activeColumnId;
      }

      trackSendMessage(message.length, selectedStyleGuides.length, dataScope, snapshot);
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
    if (!snapshot) return;
    setShowPublishConfirmation(true);
  };

  const handleConfirmPublish = async () => {
    if (!snapshot) return;
    try {
      setShowPublishConfirmation(false);
      await publish?.();
    } catch (e) {
      console.debug(e);
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
  // fake messages to test scrolling -- uncomment to if you want to test scrolling behavior, or div boundaries
  // for (let i = 0; i < 30; i++) {
  //   chatHistory.push({
  //     id: Date.now().toString(),
  //     message: `message ${i}`,
  //     role: 'user',
  //     timestamp: new Date().toISOString(),
  //     variant: 'message',
  //   });
  // }
  const chatInputEnabled = aiAgentEnabled && activeSessionId && connectionStatus === 'connected' && !agentTaskRunning;

  return (
    <SideBarContent>
      <SideBarContent.Header>
        <Group align="center" wrap="nowrap" h="100%">
          <Group
            gap="2px"
            flex={1}
            onMouseEnter={() => setShowDeleteSessionButton(true)}
            onMouseLeave={() => setShowDeleteSessionButton(false)}
          >
            <ActionIcon
              onClick={toggleRightPanel}
              size="sm"
              variant="transparent-hover"
              color="gray"
              title="Close chat"
            >
              <StyledLucideIcon Icon={PanelRightIcon} size={14} />
            </ActionIcon>

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
              disabled={!aiAgentEnabled}
            >
              <StyledLucideIcon Icon={Plus} size={14} />
            </ActionIcon>
            <SessionHistorySelector
              disabled={!aiAgentEnabled}
              onSelect={async (sessionId: string) => {
                if (sessionId) {
                  await disconnect();
                  try {
                    await activateSession(sessionId);
                    await connect(sessionId);
                    trackOpenOldChatSession(snapshot);
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
                // Reset capabilities when switching sessions
                // setAvailableCapabilities([]);
                // setSelectedCapabilities([]);
              }}
            />
          </Group>
        </Group>
      </SideBarContent.Header>
      <SideBarContent.Body scrollRef={scrollAreaRef}>
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
          <Stack gap="xs">
            {chatHistory.map((msg, index) => (
              <ChatMessageElement key={index} msg={msg} />
            ))}
          </Stack>
        ) : (
          <Center h="100%">
            {aiAgentEnabled ? (
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
      </SideBarContent.Body>
      <SideBarContent.Bottom>
        <Stack gap="2xs" my="2xs">
          <ResourceSelector
            disabled={!aiAgentEnabled}
            snapshot={snapshot}
            resetInputFocus={() => textInputRef.current?.focus()}
          />
          <ContextBadges activeTable={activeTable?.tableSpec ?? null} currentView={currentView} />
        </Stack>
        {/* User Input for Chat */}
        <AdvancedAgentInput
          snapshotId={snapshot?.id || ''}
          tableId={activeTable?.tableSpec.id.wsId || ''}
          snapshot={snapshot}
          onMessageChange={setMessage}
          onSendMessage={sendMessage}
          disabled={agentTaskRunning || !aiAgentEnabled}
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
            disabled={!aiAgentEnabled}
            c="gray"
            size="xs"
            p="0px"
            rightSection={<ChevronDownIcon size={12} color="gray" />}
          >
            <TextXsRegular component="span" c="dimmed">
              {activeModel}
            </TextXsRegular>
          </Button>
          {/* Capabilities Selection */}
          {/* {availableCapabilities.length > 0 && ( */}
          <CapabilitiesButton
            selectedCapabilities={selectedCapabilities}
            availableCapabilitiesCount={availableCapabilities.length}
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
      </SideBarContent.Bottom>

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
            trackChangeAgentModel(value, snapshot);
            setShowModelSelector(false);
          }}
        />
      </Modal>

      {/* Tools Modal */}
      <CapabilitiesModal
        opened={showToolsModal}
        onClose={() => setShowToolsModal(false)}
        availableCapabilities={availableCapabilities}
        selectedCapabilities={selectedCapabilities}
        onCapabilitiesChange={(caps) => {
          setSelectedCapabilities(caps);
          const STORAGE_KEY = 'ai-chat-selected-capabilities';
          localStorage.setItem(STORAGE_KEY, JSON.stringify(caps));
          trackChangeAgentCapabilities(caps, snapshot);
          setShowToolsModal(false);
        }}
      />

      {/* Publish Confirmation Modal */}
      <PublishConfirmationModal
        isOpen={showPublishConfirmation}
        onClose={() => setShowPublishConfirmation(false)}
        onConfirm={handleConfirmPublish}
        snapshotId={snapshot?.id ?? ''}
        serviceName={activeTable?.connectorService ?? undefined}
        isPublishing={false}
      />
    </SideBarContent>
  );
}
