import { API_CONFIG } from '@/lib/api/config';
import { ChatMessage, DataScope } from '@/types/server-entities/chat-session';
import { WebSocketCloseCode } from '@/types/websocket';
import { sleep } from '@/utils/helpers';
import pluralize from 'pluralize';
import { useCallback, useEffect, useRef, useState } from 'react';

type ClientMessageType = 'message' | 'ping' | 'echo_error';
type ServerMessageType = 'connection_confirmed' | 'pong' | 'agent_error' | 'message_progress' | 'message_response';

export interface WebSocketMessage {
  type: ClientMessageType | ServerMessageType;
  data?: object;
  timestamp?: string;
}

// The DTO for sending a message to the agent
export interface SendMessageRequestDTO {
  message: string;
  agent_jwt?: string;
  credential_id?: string;
  style_guides?: { name: string; content: string }[];
  capabilities?: string[];
  model?: string;
  active_table_id?: string;
  data_scope?: DataScope;
  record_id?: string;
  column_id?: string;
  max_records_in_prompt?: number;
  mentioned_table_ids?: string[];
  model_context_length?: number;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => Promise<void>;
}

interface UseWebSocketReturn {
  connect: (sessionId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  connectedSessionId: string | null;
  connectionStatus: 'offline' | 'connecting' | 'connected';
  connectionError: string | null;
  messageHistory: ChatMessage[];
  sendAiAgentMessage: (payload: SendMessageRequestDTO) => void;
  sendPing: () => void;
  sendEchoError: () => void;
  clearChat: () => void;
  isReconnecting: boolean;
}

export function useAIAgentChatWebSocket({ onMessage }: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const shouldReconnectRef = useRef<boolean>(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const attemptReconnectRef = useRef<(() => void) | null>(null);
  const isReconnectingRef = useRef<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'offline' | 'connecting' | 'connected'>('offline');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectedSessionId, setConnectedSessionId] = useState<string | null>(null);
  const [messageHistory, setMessageHistory] = useState<ChatMessage[]>([]);

  const MAX_RECONNECT_ATTEMPTS = 10;
  const INITIAL_RECONNECT_DELAY = 1000; // 1 second
  const MAX_RECONNECT_DELAY = 30000; // 30 seconds

  // Helper function to create and setup WebSocket handlers
  const createWebSocket = useCallback(
    (sessionId: string, isReconnect: boolean = false) => {
      const wsUrl = `${API_CONFIG.getAiAgentWebSocketUrl()}/ws/${sessionId}?auth=${API_CONFIG.getAgentJwt()}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.debug(isReconnect ? 'WebSocket reconnected' : 'WebSocket connected');
        setConnectionStatus('connected');
        setConnectionError(null);
        reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
        isReconnectingRef.current = false; // Clear reconnecting flag on successful connection
      };

      ws.onmessage = (event) => {
        try {
          console.debug('Agent websocket event:', event);
          const wsMessage: WebSocketMessage = JSON.parse(event.data);
          const chatMessages = buildResponseChatMessages(wsMessage);
          setMessageHistory((prev) => [...prev, ...chatMessages]);
          onMessage?.(wsMessage).catch((error) => {
            console.error('Error handling websocket message:', error);
          });
        } catch (error) {
          console.log('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.debug('WebSocket disconnected:', event.code, event.reason);
        setConnectionStatus('offline');
        wsRef.current = null;

        // NORMAL_CLOSURE is normal closure, don't reconnect for intentional disconnects
        if (event.code !== WebSocketCloseCode.NORMAL_CLOSURE) {
          if (event.code === WebSocketCloseCode.SERVICE_RESTART) {
            setConnectionError('Connection closed: Server restarted');
          } else {
            setConnectionError(`Connection closed: ${event.reason || 'Unknown error'}`);
          }

          // Attempt to reconnect if we should
          if (shouldReconnectRef.current && attemptReconnectRef.current) {
            console.debug('Turn on reconnect');
            attemptReconnectRef.current();
          }
        }

        if (event.code !== WebSocketCloseCode.ABNORMAL_CLOSURE) {
          // ABNORMAL_CLOSURE is a special code for when the connection is closed by the server or we failed a connection attempt
          // We don't want to add a message to the history in this case
          setMessageHistory((prev) => [
            ...prev,
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
        console.log('WebSocket error event:', error);
        setConnectionError('Failed to connect to WebSocket server');
        setConnectionStatus('offline');
        if (shouldReconnectRef.current && attemptReconnectRef.current) {
          attemptReconnectRef.current();
        }
      };

      return ws;
    },
    [onMessage],
  );

  const attemptReconnect = useCallback(() => {
    if (!shouldReconnectRef.current || !sessionIdRef.current) {
      return;
    }

    // Prevent multiple concurrent reconnection attempts
    if (isReconnectingRef.current) {
      console.debug('Reconnection already in progress, skipping duplicate attempt');
      return;
    }

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.debug('Max reconnection attempts reached');
      setConnectionError('Failed to reconnect after multiple attempts');
      shouldReconnectRef.current = false;
      isReconnectingRef.current = false;
      return;
    }

    // Clear any existing reconnect timeout before scheduling a new one
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current), MAX_RECONNECT_DELAY);

    console.debug(
      `Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`,
    );

    isReconnectingRef.current = true;
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current += 1;
      isReconnectingRef.current = false; // Clear flag when timeout fires
      if (sessionIdRef.current && shouldReconnectRef.current) {
        // Set status to connecting before attempting reconnection
        setConnectionStatus('connecting');
        // Directly create WebSocket for reconnection to avoid circular dependency
        const ws = createWebSocket(sessionIdRef.current, true);
        wsRef.current = ws;
      }
    }, delay);
  }, [createWebSocket]);

  // Store attemptReconnect in ref so createWebSocket can call it
  attemptReconnectRef.current = attemptReconnect;

  const connect = useCallback(
    async (sessionId: string, isReconnect: boolean = false) => {
      console.log(isReconnect ? 'Reconnecting WebSocket' : 'Connecting WebSocket');
      if (wsRef.current != null && (connectionStatus === 'connecting' || connectionStatus === 'connected')) return;

      // Clear any existing reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      sessionIdRef.current = sessionId;
      shouldReconnectRef.current = true;
      reconnectAttemptsRef.current = 0;
      isReconnectingRef.current = false; // Clear reconnecting flag when manually connecting
      setConnectedSessionId(sessionId);
      setConnectionStatus('connecting');
      setConnectionError(null);

      // Only clear message history on initial connection, not on reconnection
      if (!isReconnect) {
        setMessageHistory([]);
      }

      try {
        const ws = createWebSocket(sessionId, false);
        wsRef.current = ws;
      } catch (error) {
        console.log('Error creating WebSocket connection:', error);
        setConnectionError('Failed to create WebSocket connection');
        setConnectionStatus('offline');
      }
    },
    [connectionStatus, createWebSocket],
  );

  const disconnect = useCallback(async () => {
    console.log('Disconnecting WebSocket');

    // Disable auto-reconnect
    shouldReconnectRef.current = false;
    isReconnectingRef.current = false;

    // Clear any pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(WebSocketCloseCode.NORMAL_CLOSURE, 'Client disconnected');
      // give a chance for the server to close the connection and clean up
      await sleep(500);

      wsRef.current = null;
      setConnectedSessionId(null);
      setConnectionStatus('offline');
    }
  }, []);

  const sendWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      if (connectionStatus !== 'connected' || !wsRef.current) {
        return;
      }
      wsRef.current.send(JSON.stringify(message));
    },
    [wsRef, connectionStatus],
  );

  const sendAiAgentMessage = useCallback(
    (data: SendMessageRequestDTO) => {
      // update with the most recent agent JWT token
      data.agent_jwt = API_CONFIG.getAgentJwt() || undefined;

      console.log('Sending WebSocket message:', data);

      sendWebSocketMessage({
        type: 'message',
        data: data,
      });

      setMessageHistory((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'user',
          message: data.message,
          timestamp: new Date().toISOString(),
          variant: 'message',
        },
      ]);
    },
    [sendWebSocketMessage],
  );

  const sendPing = useCallback(() => {
    sendWebSocketMessage({
      type: 'ping',
    });

    setMessageHistory((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        message: 'ping',
        timestamp: new Date().toISOString(),
        variant: 'message',
      },
    ]);
  }, [sendWebSocketMessage]);

  const sendEchoError = useCallback(() => {
    sendWebSocketMessage({
      type: 'echo_error',
    });

    setMessageHistory((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        message: 'echo_error',
        timestamp: new Date().toISOString(),
        variant: 'message',
      },
    ]);
  }, [sendWebSocketMessage]);

  const clearChat = useCallback(() => {
    setMessageHistory([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Disable auto-reconnect
      shouldReconnectRef.current = false;
      isReconnectingRef.current = false;

      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close WebSocket if still open
      if (wsRef.current) {
        wsRef.current.close(WebSocketCloseCode.NORMAL_CLOSURE, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, []);

  return {
    connectionStatus,
    connectionError,
    messageHistory,
    connectedSessionId,
    connect,
    disconnect,
    sendAiAgentMessage,
    sendPing,
    sendEchoError,
    clearChat,
    isReconnecting: shouldReconnectRef.current,
  };
}

export interface BasicAgentMessageDataPayload {
  message: string;
}

export interface AgentErrorResponseDataPayload {
  detail: string;
}

export interface UsageStats {
  requests: number;
  request_tokens: number;
  response_tokens: number;
  total_tokens: number;
}

export interface AgentResponseDataPayload {
  response_message: string;
  response_summary: string;
  request_summary: string;
  usage_stats: UsageStats;
}

export interface AgentProgressMessageData {
  progress_type:
    | 'run_started'
    | 'status'
    | 'tool_call'
    | 'tool_result'
    | 'create_agent'
    | 'request_sent'
    | 'model_response'
    | 'build_response';
  message: string;
  payload: Record<string, unknown>;
}

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
