'use client';

import { Alert, Badge, Button, Container, Group, Paper, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { CheckCircleIcon, PaperPlaneRightIcon, XCircleIcon } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';

export type ClientMessageType = 'message' | 'ping' | 'echo_error';
export type ServerMessageType = 'connection_confirmed' | 'pong' | 'agent_error' | 'message_response';

interface WebSocketMessage {
  type: ClientMessageType | ServerMessageType;
  data?: object;
  timestamp?: string;
}

export type AgentErrorResponseData = {
  detail: string;
};

export type SimpleResponseMessageData = {
  message: string;
};

export type AgentResponseMessageData = {
  message: string;
};

interface ChatMessage {
  id: string;
  type: 'sent' | 'received';
  message: string;
  timestamp: string;
}

export default function AgentWebSocketTestPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState('test-session-' + Date.now());
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const connectWebSocket = async () => {
    if (isConnected || isConnecting) return;

    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Assuming the WebSocket server is running on the same host but different port
      // You may need to adjust this URL based on your setup
      const wsUrl = `ws://localhost:8000/ws/${sessionId}?api_token=1234567890`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.debug('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);

        // Add connection message
        setChatMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: 'received',
            message: 'Connected to AI Agent WebSocket',
            timestamp: new Date().toISOString(),
          },
        ]);
      };

      ws.onmessage = (event) => {
        try {
          console.debug('Received event:', event);
          const message: WebSocketMessage = JSON.parse(event.data);

          setChatMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              type: 'received',
              message: message.data ? JSON.stringify(message.data) : '',
              timestamp: message.timestamp || new Date().toISOString(),
            },
          ]);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.debug('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);

        if (event.code !== 1000) {
          // Not a normal closure
          setConnectionError(`Connection closed: ${event.reason || 'Unknown error'}`);
        }

        setChatMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: 'received',
            message: 'Disconnected from AI Agent WebSocket',
            timestamp: new Date().toISOString(),
          },
        ]);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Failed to connect to WebSocket server');
        setIsConnecting(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setConnectionError('Failed to create WebSocket connection');
      setIsConnecting(false);
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
  };

  const sendPing = () => {
    if (!isConnected || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'ping' }));
  };

  const sendEchoError = () => {
    if (!isConnected || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'echo_error' }));
  };

  const sendMessage = () => {
    if (!isConnected || !message.trim() || !wsRef.current) return;

    const messageData: WebSocketMessage = {
      type: 'message',
      data: {
        message: message.trim(),
      },
    };

    try {
      wsRef.current.send(JSON.stringify(messageData));

      // Add sent message to chat
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          type: 'sent',
          message: message.trim(),
          timestamp: new Date().toISOString(),
        },
      ]);

      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setConnectionError('Failed to send message');
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setChatMessages([]);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="xl">
        AI Agent WebSocket Test
      </Title>

      {/* Connection Controls */}
      <Paper p="md" mb="md" withBorder>
        <Stack gap="md">
          <Group>
            <TextInput
              label="Session ID"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Enter session ID"
              style={{ flex: 1 }}
            />
            <Badge
              color={isConnected ? 'green' : isConnecting ? 'yellow' : 'red'}
              size="lg"
              style={{ alignSelf: 'end' }}
            >
              {isConnected ? (
                <>
                  <CheckCircleIcon size={16} />
                  Connected
                </>
              ) : isConnecting ? (
                <>
                  <CheckCircleIcon size={16} />
                  Connecting...
                </>
              ) : (
                <>
                  <XCircleIcon size={16} />
                  Disconnected
                </>
              )}
            </Badge>
          </Group>

          <Group>
            <Button
              onClick={connectWebSocket}
              disabled={isConnected || isConnecting}
              leftSection={<CheckCircleIcon size={16} />}
            >
              Connect
            </Button>
            <Button
              onClick={disconnectWebSocket}
              disabled={!isConnected}
              variant="outline"
              color="red"
              leftSection={<XCircleIcon size={16} />}
            >
              Disconnect
            </Button>
            <Button onClick={clearChat} variant="outline" disabled={chatMessages.length === 0}>
              Clear Chat
            </Button>
          </Group>

          {connectionError && (
            <Alert color="red" title="Connection Error">
              {connectionError}
            </Alert>
          )}
        </Stack>
      </Paper>

      {/* Chat Interface */}
      <Paper p="md" withBorder style={{ height: '500px', display: 'flex', flexDirection: 'column' }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
          {chatMessages.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No messages yet. Connect and start chatting!
            </Text>
          ) : (
            <Stack gap="sm">
              {chatMessages.map((msg, idx) => (
                <Paper
                  key={idx}
                  p="sm"
                  bg={msg.type === 'sent' ? 'blue.0' : 'gray.0'}
                  style={{
                    alignSelf: msg.type === 'sent' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                  }}
                >
                  <Text size="sm" mb="xs">
                    {msg.message}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatTimestamp(msg.timestamp)}
                  </Text>
                </Paper>
              ))}
              <div ref={messagesEndRef} />
            </Stack>
          )}
        </div>

        {/* Message Input */}
        <Group align="flex-end" gap="sm">
          <Textarea
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!isConnected}
            style={{ flex: 1 }}
            minRows={1}
            maxRows={4}
            autosize
          />
          <Button
            onClick={sendMessage}
            disabled={!isConnected || !message.trim()}
            leftSection={<PaperPlaneRightIcon size={16} />}
          >
            Send
          </Button>
        </Group>
        <Group gap="sm" mt="sm">
          <Button
            variant="outline"
            size="xs"
            onClick={sendPing}
            disabled={!isConnected}
            leftSection={<PaperPlaneRightIcon size={16} />}
          >
            Ping
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={sendEchoError}
            disabled={!isConnected}
            leftSection={<PaperPlaneRightIcon size={16} />}
          >
            Echo Error
          </Button>
        </Group>
      </Paper>

      {/* Instructions */}
      <Paper p="md" mt="md" withBorder>
        <Text size="sm" c="dimmed">
          <strong>Instructions:</strong> Enter a session ID and click Connect to establish a WebSocket connection with
          the AI Agent. Once connected, you can send messages and receive responses in real-time. The WebSocket server
          expects messages in the format: {JSON.stringify({ type: 'message', message: 'your text' }, null, 2)}.
        </Text>
      </Paper>
    </Container>
  );
}
