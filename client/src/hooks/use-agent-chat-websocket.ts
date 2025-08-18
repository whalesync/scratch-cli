import { API_CONFIG } from '@/lib/api/config';
import { RecordCell } from '@/types/common';
import { ChatMessage } from '@/types/server-entities/chat-session';
import { sleep } from '@/utils/helpers';
import pluralize from 'pluralize';
import { useCallback, useRef, useState } from 'react';

type ClientMessageType = 'message' | 'ping' | 'echo_error';
type ServerMessageType = 'connection_confirmed' | 'pong' | 'agent_error' | 'message_progress' | 'message_response';

export interface WebSocketMessage {
  type: ClientMessageType | ServerMessageType;
  data?: object;
  timestamp?: string;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
}

interface UseWebSocketReturn {
  connect: (sessionId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  connectedSessionId: string | null;
  connectionStatus: 'offline' | 'connecting' | 'connected';
  connectionError: string | null;
  messageHistory: ChatMessage[];
  sendAiAgentMessage: (payload: AIAgentMessage) => void;
  sendPing: () => void;
  sendEchoError: () => void;
  clearChat: () => void;
}

export type AIAgentMessage = {
  message: string;
  api_token?: string;
  style_guides?: Array<{ name: string; content: string }>;
  capabilities?: string[];
  model?: string;
  view_id?: string;
  read_focus?: RecordCell[];
  write_focus?: RecordCell[];
}

export function useAIAgentChatWebSocket({
  onMessage,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'offline' | 'connecting' | 'connected'>('offline');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectedSessionId, setConnectedSessionId] = useState<string | null>(null);
  const [messageHistory, setMessageHistory] = useState<ChatMessage[]>([]);
  
  const connect = useCallback(async (sessionId: string) => {
    console.log('Connecting WebSocket');
    if (wsRef.current != null && (connectionStatus === 'connecting' || connectionStatus === 'connected')) return;

    setConnectionStatus('connecting');
    setConnectionError(null);
    setMessageHistory([]);

    try {
      // Assuming the WebSocket server is running on the same host but different port
      // You may need to adjust this URL based on your setup
      const wsUrl = `${API_CONFIG.getAiAgentWebSocketUrl()}/ws/${sessionId}?api_token=${API_CONFIG.getAiAgentApiToken()}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.debug('WebSocket connected');
        setConnectionStatus('connected');
        setConnectionError(null);
     };

      ws.onmessage = (event) => {
        try {
          console.debug('Agent websocket event:', event);
          const wsMessage: WebSocketMessage = JSON.parse(event.data);
          const chatMessages = buildResponseChatMessages(wsMessage);
          setMessageHistory((prev) => [
            ...prev,
            ...chatMessages,
          ]);
          onMessage?.(wsMessage);

        } catch (error) {
          console.log('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.debug('WebSocket disconnected:', event.code, event.reason);
        setConnectionStatus('offline');

        if (event.code !== 1000) {
          // Not a normal closure
          setConnectionError(`Connection closed: ${event.reason || 'Unknown error'}`);
        }

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
      };

      ws.onerror = (error) => {
        console.log('WebSocket error:', error);
        setConnectionError('Failed to connect to WebSocket server');
        setConnectionStatus('offline');
      };

      wsRef.current = ws;
    } catch (error) {
      console.log('Error creating WebSocket connection:', error);
      setConnectionError('Failed to create WebSocket connection');
      setConnectionStatus('offline');
    }
  }, [connectionStatus, onMessage]);

  const disconnect = useCallback(async () => {
    console.log('Disconnecting WebSocket');
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnected');
      // give a chance for the server to close the connection and clean up
      await sleep(500);

      wsRef.current = null;
      setConnectedSessionId(null);
      setConnectionStatus('offline');
    }
  }, [wsRef]);

  const sendWebSocketMessage = useCallback((message: WebSocketMessage) => {
    if (connectionStatus !== 'connected' || !wsRef.current) {
      return;
    }
    wsRef.current.send(JSON.stringify(message));
  }, [wsRef, connectionStatus]);
  
  const sendAiAgentMessage = useCallback((data: AIAgentMessage) => {
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

  }, [sendWebSocketMessage]);

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
  progress_type: 'run_started' | 'status' | 'tool_call' | 'tool_result';
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
      message: `Modal usage: ${x.usage_stats.requests} ${pluralize('request', x.usage_stats.requests)} and ${x.usage_stats.total_tokens} tokens used (${x.usage_stats.request_tokens} request, ${x.usage_stats.response_tokens} response)`,
      timestamp: message.timestamp || new Date().toISOString(),
      payload: x.usage_stats,
      variant: 'admin',
    });
  } else {
    displayMessage = 'Unknown message type';
  }

  return [{
    id: new Date().getTime().toString(),
    role: 'assistant',
    message: displayMessage,
    timestamp: message.timestamp || new Date().toISOString(),
    payload: message.data,
    variant,
  }, ...additionalMessages];
}

