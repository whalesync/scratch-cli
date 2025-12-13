import { API_CONFIG } from '@/lib/api/config';
import {
  AgentErrorResponseDataPayload,
  AgentResponseDataPayload,
  BasicAgentMessageDataPayload,
  WebSocketMessage,
} from '@/types/agent-websocket';
import { ChatMessage, SendMessageRequestDTO } from '@spinner/shared-types';
import { sleep } from '@/utils/helpers';
import { WebSocketCloseCode } from '@/utils/websocket';
import pluralize from 'pluralize';
import { create } from 'zustand';

/**
 A Zustand store that manages WebSocket connections to the AI Agent as a singleton, ensuring stable connections across component lifecycles.

  - Singleton WebSocket: One WebSocket connection shared across all components
  - Automatic Reconnection: Exponential backoff retry logic with configurable attempts
  - Message History: Centralized chat message management
  - Multiple Message Handlers: Register multiple callbacks to react to WebSocket messages
  - Optimized Selectors: Use granular selectors to prevent unnecessary re-renders
 */

type State = {
  ws: WebSocket | null;
  connectionStatus: 'offline' | 'connecting' | 'connected';
  connectionError: string | null;
  connectedSessionId: string | null;
  messageHistory: ChatMessage[];
  isReconnecting: boolean;

  // Internal state (not meant to be observed directly)
  sessionId: string | null;
  shouldReconnect: boolean;
  reconnectAttempts: number;
  reconnectTimeout: NodeJS.Timeout | null;

  // Message handlers
  messageHandlers: Set<(message: WebSocketMessage) => Promise<void> | void>;
};

type Actions = {
  connect: (sessionId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  sendAiAgentMessage: (payload: SendMessageRequestDTO) => void;
  sendPing: () => void;
  sendEchoError: () => void;
  clearChat: () => void;

  // Handler management
  addMessageHandler: (handler: (message: WebSocketMessage) => Promise<void> | void) => () => void;
  removeMessageHandler: (handler: (message: WebSocketMessage) => Promise<void> | void) => void;

  // Internal actions
  _setConnectionStatus: (status: State['connectionStatus']) => void;
  _setConnectionError: (error: string | null) => void;
  _addMessages: (messages: ChatMessage[]) => void;
  _attemptReconnect: () => void;
  _createWebSocket: (sessionId: string, isReconnect?: boolean) => WebSocket;
};

type AgentChatWebSocketStore = State & Actions;

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

function buildResponseChatMessages(message: WebSocketMessage): ChatMessage[] {
  let displayMessage = '';
  let variant: ChatMessage['variant'] = 'message';
  const additionalMessages: ChatMessage[] = [];

  if (message.type === 'connection_confirmed' || message.type === 'pong' || message.type === 'message_progress') {
    const x = message.data as BasicAgentMessageDataPayload;
    displayMessage = x.message;

    if (message.type === 'connection_confirmed') {
      variant = 'admin';
    } else if (message.type === 'message_progress') {
      console.debug('Progress message received:', {
        message,
        data: message.data,
        fullMessage: JSON.stringify(message, null, 2),
      });
      variant = 'progress';
    }
  } else if (message.type === 'agent_error') {
    const x = message.data as AgentErrorResponseDataPayload;
    displayMessage = x.detail;
    variant = 'error';
  } else if (message.type === 'message_response') {
    const x = message.data as AgentResponseDataPayload;
    displayMessage = x.response_message;
    additionalMessages.push({
      id: new Date().getTime().toString(),
      role: 'assistant',
      message: `Usage: ${x.usage_stats.requests} ${pluralize('request', x.usage_stats.requests)} and ${x.usage_stats.total_tokens} tokens used (${x.usage_stats.request_tokens} request, ${x.usage_stats.response_tokens} response)`,
      timestamp: message.timestamp || new Date().toISOString(),
      payload: x.usage_stats,
      variant: 'usage',
    });
  } else {
    displayMessage = 'Unknown message type';
  }

  return [
    {
      id: new Date().getTime().toString(),
      role: 'assistant',
      message: displayMessage,
      timestamp: message.timestamp || new Date().toISOString(),
      payload: message.data,
      variant,
    },
    ...additionalMessages,
  ];
}

export const useAgentChatWebSocketStore = create<AgentChatWebSocketStore>((set, get) => ({
  // Initial state
  ws: null,
  connectionStatus: 'offline',
  connectionError: null,
  connectedSessionId: null,
  messageHistory: [],
  isReconnecting: false,
  sessionId: null,
  shouldReconnect: false,
  reconnectAttempts: 0,
  reconnectTimeout: null,
  messageHandlers: new Set(),

  _setConnectionStatus: (status) => set({ connectionStatus: status }),

  _setConnectionError: (error) => set({ connectionError: error }),

  _addMessages: (messages) =>
    set((state) => ({
      messageHistory: [...state.messageHistory, ...messages],
    })),

  _createWebSocket: (sessionId: string, isReconnect: boolean = false) => {
    const wsUrl = `${API_CONFIG.getAiAgentWebSocketUrl()}/ws/${sessionId}?auth=${API_CONFIG.getAgentJwt()}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.debug(isReconnect ? 'WebSocket reconnected' : 'WebSocket connected');
      set({
        connectionStatus: 'connected',
        connectionError: null,
        reconnectAttempts: 0,
        isReconnecting: false,
      });
    };

    ws.onmessage = async (event) => {
      try {
        console.debug('Agent websocket event:', event);
        const wsMessage: WebSocketMessage = JSON.parse(event.data);
        const chatMessages = buildResponseChatMessages(wsMessage);

        // Add messages to history
        get()._addMessages(chatMessages);

        // Call all registered handlers
        const handlers = get().messageHandlers;
        for (const handler of handlers) {
          try {
            await handler(wsMessage);
          } catch (error) {
            console.error('Error in message handler:', error);
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = (event) => {
      console.debug('WebSocket disconnected:', event.code, event.reason);
      set({ connectionStatus: 'offline', ws: null });

      // NORMAL_CLOSURE is normal closure, don't reconnect for intentional disconnects
      if (event.code !== WebSocketCloseCode.NORMAL_CLOSURE) {
        if (event.code === WebSocketCloseCode.SERVICE_RESTART) {
          set({ connectionError: 'Connection closed: Server restarted' });
        } else {
          set({ connectionError: `Connection closed: ${event.reason || 'Unknown error'}` });
        }

        // Attempt to reconnect if we should
        if (get().shouldReconnect) {
          console.debug('Turn on reconnect');
          get()._attemptReconnect();
        }
      }

      if (event.code !== WebSocketCloseCode.ABNORMAL_CLOSURE) {
        // ABNORMAL_CLOSURE is a special code for when the connection is closed by the server or we failed a connection attempt
        // We don't want to add a message to the history in this case
        get()._addMessages([
          {
            id: Date.now().toString(),
            role: 'assistant',
            message: 'Disconnected from AI Agent',
            timestamp: new Date().toISOString(),
            variant: 'admin',
          },
        ]);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error event:', error);
      set({
        connectionError: 'Failed to connect to WebSocket server',
        connectionStatus: 'offline',
      });

      if (get().shouldReconnect) {
        get()._attemptReconnect();
      }
    };

    return ws;
  },

  _attemptReconnect: () => {
    const state = get();

    if (!state.shouldReconnect || !state.sessionId) {
      return;
    }

    // Prevent multiple concurrent reconnection attempts
    if (state.isReconnecting) {
      console.debug('Reconnection already in progress, skipping duplicate attempt');
      return;
    }

    if (state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.debug('Max reconnection attempts reached');
      set({
        connectionError: 'Failed to reconnect after multiple attempts',
        shouldReconnect: false,
        isReconnecting: false,
      });
      return;
    }

    // Clear any existing reconnect timeout before scheduling a new one
    if (state.reconnectTimeout) {
      clearTimeout(state.reconnectTimeout);
    }

    const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, state.reconnectAttempts), MAX_RECONNECT_DELAY);

    console.debug(
      `Attempting to reconnect in ${delay}ms (attempt ${state.reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`,
    );

    const timeout = setTimeout(() => {
      const currentState = get();

      set({
        reconnectAttempts: currentState.reconnectAttempts + 1,
        isReconnecting: false,
        reconnectTimeout: null,
      });

      if (currentState.sessionId && currentState.shouldReconnect) {
        // Set status to connecting before attempting reconnection
        set({ connectionStatus: 'connecting' });

        // Directly create WebSocket for reconnection
        const ws = get()._createWebSocket(currentState.sessionId, true);
        set({ ws });
      }
    }, delay);

    set({
      isReconnecting: true,
      reconnectTimeout: timeout,
    });
  },

  connect: async (sessionId: string) => {
    const state = get();
    console.debug('Connecting WebSocket', sessionId);

    if (state.ws != null && (state.connectionStatus === 'connecting' || state.connectionStatus === 'connected')) {
      return;
    }

    // Clear any existing reconnect timeout
    if (state.reconnectTimeout) {
      clearTimeout(state.reconnectTimeout);
    }

    set({
      sessionId,
      shouldReconnect: true,
      reconnectAttempts: 0,
      isReconnecting: false,
      connectedSessionId: sessionId,
      connectionStatus: 'connecting',
      connectionError: null,
      messageHistory: [],
      reconnectTimeout: null,
    });

    try {
      const ws = get()._createWebSocket(sessionId, false);
      set({ ws });
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      set({
        connectionError: 'Failed to create WebSocket connection',
        connectionStatus: 'offline',
      });
    }
  },

  disconnect: async () => {
    console.debug('Disconnecting WebSocket');
    const state = get();

    // Clear any pending reconnect timeout
    if (state.reconnectTimeout) {
      clearTimeout(state.reconnectTimeout);
    }

    // Disable auto-reconnect
    set({
      shouldReconnect: false,
      isReconnecting: false,
      reconnectTimeout: null,
    });

    if (state.ws) {
      state.ws.close(WebSocketCloseCode.NORMAL_CLOSURE, 'Client disconnected');
      // give a chance for the server to close the connection and clean up
      await sleep(500);

      set({
        ws: null,
        connectedSessionId: null,
        connectionStatus: 'offline',
      });
    }
  },

  sendAiAgentMessage: (data: SendMessageRequestDTO) => {
    const state = get();

    if (state.connectionStatus !== 'connected' || !state.ws) {
      return;
    }

    // update with the most recent agent JWT token
    data.agent_jwt = API_CONFIG.getAgentJwt() || undefined;

    console.debug('Sending WebSocket message:', data);

    state.ws.send(
      JSON.stringify({
        type: 'message',
        data: data,
      }),
    );

    get()._addMessages([
      {
        id: Date.now().toString(),
        role: 'user',
        message: data.message,
        timestamp: new Date().toISOString(),
        variant: 'message',
      },
    ]);
  },

  sendPing: () => {
    const state = get();

    if (state.connectionStatus !== 'connected' || !state.ws) {
      return;
    }

    state.ws.send(
      JSON.stringify({
        type: 'ping',
      }),
    );

    get()._addMessages([
      {
        id: Date.now().toString(),
        role: 'user',
        message: 'ping',
        timestamp: new Date().toISOString(),
        variant: 'message',
      },
    ]);
  },

  sendEchoError: () => {
    const state = get();

    if (state.connectionStatus !== 'connected' || !state.ws) {
      return;
    }

    state.ws.send(
      JSON.stringify({
        type: 'echo_error',
      }),
    );

    get()._addMessages([
      {
        id: Date.now().toString(),
        role: 'user',
        message: 'echo_error',
        timestamp: new Date().toISOString(),
        variant: 'message',
      },
    ]);
  },

  clearChat: () => set({ messageHistory: [] }),

  addMessageHandler: (handler) => {
    set((state) => {
      const newHandlers = new Set(state.messageHandlers);
      newHandlers.add(handler);
      return { messageHandlers: newHandlers };
    });

    // Return cleanup function
    return () => get().removeMessageHandler(handler);
  },

  removeMessageHandler: (handler) => {
    set((state) => {
      const newHandlers = new Set(state.messageHandlers);
      newHandlers.delete(handler);
      return { messageHandlers: newHandlers };
    });
  },
}));

// Selector hooks for optimized re-renders
export const useAgentConnectionStatus = () => useAgentChatWebSocketStore((state) => state.connectionStatus);

export const useAgentConnectionError = () => useAgentChatWebSocketStore((state) => state.connectionError);

export const useAgentMessageHistory = () => useAgentChatWebSocketStore((state) => state.messageHistory);

export const useAgentConnectedSessionId = () => useAgentChatWebSocketStore((state) => state.connectedSessionId);

export const useAgentIsReconnecting = () => useAgentChatWebSocketStore((state) => state.isReconnecting);
