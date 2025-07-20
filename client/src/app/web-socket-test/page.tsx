'use client';

import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { API_CONFIG } from '@/lib/api/config';
import { Button, Container, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function WebSocketTestPage() {
  const [messages, setMessages] = useState<string[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useScratchPadUser();

  useEffect(() => {
    // Create Socket.IO connection
    const newSocket = io(API_CONFIG.getApiUrl(), {
      transports: ['websocket'],
      path: '/snapshot-events',
      auth: {
        token: user?.apiToken || '',
      },
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.debug('Socket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.debug('Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.debug('Socket connection error', error);
    });

    // Listen for messages
    newSocket.on('pong', (data) => {
      console.debug('Received message:', data);
      setMessages((prev) => [...prev, typeof data === 'string' ? data : JSON.stringify(data)]);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, [user]);

  const sendPing = () => {
    if (socket && isConnected) {
      socket.emit('ping');
      console.debug('Sent ping');
    }
  };

  return (
    <Container size="md">
      <Stack>
        <Text>Connection status: {isConnected ? 'Connected' : 'Disconnected'}</Text>
        <Button onClick={sendPing} disabled={!isConnected}>
          Send ping
        </Button>
        <Text>Messages received:</Text>
        {messages.map((message, index) => (
          <Text key={index}>{message}</Text>
        ))}
      </Stack>
    </Container>
  );
}
