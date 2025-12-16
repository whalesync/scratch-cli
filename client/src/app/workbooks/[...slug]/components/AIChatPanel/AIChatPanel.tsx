'use client';

import { AdvancedAgentInput } from '@/app/components/AdvancedAgentInput/AdvancedAgentInput';
import { Command } from '@/app/components/AdvancedAgentInput/CommandSuggestions';
import {
  ButtonSecondaryInline,
  ButtonSecondaryOutline,
  ButtonSecondarySolid,
  IconButtonOutline,
} from '@/app/components/base/buttons';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import ModelPickerModal from '@/app/components/ModelPickerModal';
import { gettingStartedFlowUI } from '@/app/components/onboarding/getting-started/getting-started';
import { OnboardingStepContent } from '@/app/components/onboarding/OnboardingStepContent';
import { ToolbarIconButton } from '@/app/components/ToolbarIconButton';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useAgentChatContext } from '@/app/workbooks/[...slug]/components/contexts/agent-chat-context';
import { useAIAgentSessionManagerContext } from '@/contexts/ai-agent-session-manager-context';
import { isOverCreditLimit, useAgentCredentials } from '@/hooks/use-agent-credentials';
import { usePromptAssets } from '@/hooks/use-prompt-assets';
import { useOnboardingUpdate } from '@/hooks/useOnboardingUpdate';
import {
  trackChangeAgentCapabilities,
  trackChangeAgentModel,
  trackOpenOldChatSession,
  trackSendMessage,
  trackStartAgentSession,
} from '@/lib/posthog';
import { useAgentChatWebSocketStore } from '@/stores/agent-chat-websocket-store';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { AgentProgressMessageData, WebSocketMessage } from '@/types/agent-websocket';
import { sleep } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import { formatTokenCount } from '@/utils/token-counter';
import { Alert, Anchor, Box, Center, Divider, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { AGENT_CAPABILITIES, Capability, SendMessageRequestDTO, SnapshotTableId } from '@spinner/shared-types';
import { ChevronDownIcon, CircleStopIcon, LucideFileKey, Plus, SendIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useActiveWorkbook } from '../../../../../hooks/use-active-workbook';
import { Text12Regular, Text13Medium } from '../../../../components/base/text';
import { WORKBOOK_TAB_BAR_HEIGHT } from '../WorkbookTabBar';
import classes from './AIChatPanel.module.css';
import CapabilitiesButton from './CapabilitiesButton';
import ToolsModal from './CapabilitiesModal';
import { ChatMessageElement } from './ChatMessageElement';
import { PromptAssetSelector } from './PromptAssetSelector';
import { SessionHistorySelector } from './SessionHistorySelector';
import { TokenUseButton } from './TokenUseButton';

export default function AIChatPanel() {
  const { workbook, activeTable } = useActiveWorkbook();
  const { activeOpenRouterCredentials } = useAgentCredentials(true);
  const { markStepCompleted } = useOnboardingUpdate();
  const closeChat = useWorkbookEditorUIStore((state) => state.closeChat);
  const openPublishConfirmation = useWorkbookEditorUIStore((state) => state.openPublishConfirmation);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | React.ReactNode | null>(null);
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

  // All the state variables and API actions for the Agent Websocket
  const connectionStatus = useAgentChatWebSocketStore((state) => state.connectionStatus);
  const connectionError = useAgentChatWebSocketStore((state) => state.connectionError);
  const messageHistory = useAgentChatWebSocketStore((state) => state.messageHistory);
  const connect = useAgentChatWebSocketStore((state) => state.connect);
  const disconnect = useAgentChatWebSocketStore((state) => state.disconnect);
  const sendAiAgentMessage = useAgentChatWebSocketStore((state) => state.sendAiAgentMessage);
  const sendPing = useAgentChatWebSocketStore((state) => state.sendPing);
  const clearChat = useAgentChatWebSocketStore((state) => state.clearChat);
  const addMessageHandler = useAgentChatWebSocketStore((state) => state.addMessageHandler);

  useEffect(() => {
    // return a cleanup function that removes the message handler when the component unmounts
    const cleanup = addMessageHandler(handleWebsocketMessage);
    return () => cleanup();
  }, [addMessageHandler, handleWebsocketMessage]);

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

  const onDeleteSessionClick = useCallback(async () => {
    if (!activeSessionId) {
      return;
    }
    await disconnect();
    clearActiveSession();
    await deleteSession(activeSessionId);
  }, [activeSessionId, clearActiveSession, deleteSession, disconnect]);

  const onSessionHistorySelected = useCallback(
    async (sessionId: string) => {
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
    },
    [
      clearActiveSession,
      disconnect,
      activateSession,
      connect,
      workbook,
      setMessage,
      setResetInputFocus,
      scrollToBottom,
      setError,
    ],
  );

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

    if (isOverCreditLimit(activeOpenRouterCredentials)) {
      setError('Your current OpenRouter key is over its credit limit');
      setErrorDetails(
        <Group gap="2px">
          You can switch credentials on the{' '}
          <Anchor href={RouteUrls.settingsPageUrl} target="_blank" c="var(--fg-secondary)" size="xs">
            Settings
          </Anchor>{' '}
          page.
        </Group>,
      );
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

      // Mark onboarding step as completed
      markStepCompleted('gettingStartedV1', 'contentEditedWithAi');

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
      bd="0.5px solid var(--fg-divider)"
    >
      <Box h={WORKBOOK_TAB_BAR_HEIGHT} className={classes.chatPanelHeader}>
        <Group
          align="center"
          wrap="nowrap"
          h="100%"
          gap={2}
          onMouseEnter={() => setShowDeleteSessionButton(true)}
          onMouseLeave={() => setShowDeleteSessionButton(false)}
        >
          <ToolIconButton icon={XIcon} onClick={closeChat} />
          <Text13Medium>{activeSession?.name ?? 'Chat'}</Text13Medium>
          {activeSession && showDeleteSessionButton && (
            <ToolbarIconButton
              icon={Trash2Icon}
              onClick={onDeleteSessionClick}
              title="Delete session"
              disabled={!activeSessionId}
            />
          )}
          <Box flex={1} />
          <ToolbarIconButton
            icon={Plus}
            onClick={createNewSession}
            title="New chat"
            disabled={!activeOpenRouterCredentials}
          />
          <SessionHistorySelector disabled={!activeOpenRouterCredentials} onSelect={onSessionHistorySelected} />
        </Group>
      </Box>
      <Box w="100%" h="100%" className={classes.chatPanelBody} ref={scrollAreaRef}>
        {/* Error Alert */}
        {error && (
          <Alert color="red" mb="sm" p="xs" title={error} withCloseButton onClose={() => setError(null)}>
            {errorDetails && <Text12Regular>{errorDetails}</Text12Regular>}
          </Alert>
        )}
        {connectionError && (
          <Alert color="red" mb="sm" p="xs">
            <Text size="xs">{connectionError}</Text>
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
            {!activeOpenRouterCredentials && (
              <Stack gap="xs" justify="center" align="center">
                <Text size="xs">You must configure your OpenRouter credentials to use the AI agent</Text>
                <ButtonSecondaryOutline component="a" href={RouteUrls.settingsPageUrl} size="xs" w="fit-content">
                  Configure credentials
                </ButtonSecondaryOutline>
              </Stack>
            )}
          </Center>
        )}
      </Box>

      {/* Input section at the bottom */}
      <Box mih="150px" className={classes.chatPanelFooter}>
        {/* Context chips and badges */}
        <PromptAssetSelector
          disabled={!activeOpenRouterCredentials}
          workbook={workbook}
          resetInputFocus={() => textInputRef.current?.focus()}
        />
        <Divider />

        {/* User Input for Chat */}
        <OnboardingStepContent flow={gettingStartedFlowUI} stepKey="contentEditedWithAi">
          <Box h={0} />
        </OnboardingStepContent>

        <AdvancedAgentInput
          ref={textInputRef}
          tableId={(activeTable?.id as SnapshotTableId) || ''}
          workbook={workbook}
          onMessageChange={setMessage}
          onSendMessage={sendMessage}
          disabled={agentTaskRunning || !activeOpenRouterCredentials}
          onFocus={handleTextInputFocus}
          commands={commands}
        />

        {/* Footer row */}
        <Group gap={0} mx={6} my={6} align="end" wrap="nowrap">
          {/* Credentials picker */}
          {/* TODO: Move this out of the footer: */}
          <Tooltip
            multiline
            w={220}
            label={`Using ${activeOpenRouterCredentials?.label} key. ${activeOpenRouterCredentials?.name}`}
          >
            <Box>
              <StyledLucideIcon Icon={LucideFileKey} size="md" strokeWidth={1} />
            </Box>
          </Tooltip>

          {/* Model picker */}
          <Tooltip label={`${activeModel.value} (${formatTokenCount(activeModel.contextLength ?? 1)})`}>
            <ButtonSecondaryInline
              onClick={() => setShowModelSelector(true)}
              disabled={!activeOpenRouterCredentials}
              rightSection={<ChevronDownIcon size={12} />}
              w="auto"
              styles={{
                // This is the longest and most variable text, so we want it to shrink if we run out of space. Everything else in this row has flexShrink: 0.
                // To get the ellipsis we need to set display to block, which requires lineHeight for vertical centering.
                root: { flexShrink: 1, minWidth: 0 },
                label: {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                  lineHeight: '26px',
                },
                section: { flexShrink: 0 },
              }}
            >
              {`${activeModel.value} (${formatTokenCount(activeModel.contextLength ?? 1)})`}
            </ButtonSecondaryInline>
          </Tooltip>

          {/* Tools Selection */}
          <CapabilitiesButton
            selectedCapabilities={selectedCapabilities}
            availableCapabilitiesCount={AGENT_CAPABILITIES.length}
            onClick={() => setShowToolsModal(true)}
          />

          {/* Token usage */}
          {activeTable && <TokenUseButton table={activeTable} />}

          {/* Extra space */}
          <div style={{ flex: 1 }} />

          {/* Start button */}
          {!agentTaskRunning && (
            <IconButtonOutline
              size="xs"
              onClick={sendMessage}
              disabled={!message.trim() || !chatInputEnabled}
              style={{ flexShrink: 0 }}
            >
              <SendIcon size={16} />
            </IconButtonOutline>
          )}
          {/* Stop button */}
          {agentTaskRunning && (
            <ButtonSecondarySolid
              size="xs"
              onClick={() => runningAgentTaskId && cancelAgentRun(runningAgentTaskId)}
              disabled={!runningAgentTaskId || !agentTaskRunning}
              leftSection={<CircleStopIcon size={16} />}
              style={{ flexShrink: 0 }}
            >
              Stop
            </ButtonSecondarySolid>
          )}
        </Group>
      </Box>
      {/* Model Selector Modal */}
      <ModelPickerModal
        opened={showModelSelector}
        onClose={() => setShowModelSelector(false)}
        currentModelOption={activeModel}
        onSelectModel={(value) => {
          setActiveModel(value);
          trackChangeAgentModel(activeModel.value, workbook);
          setShowModelSelector(false);
        }}
      />
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
