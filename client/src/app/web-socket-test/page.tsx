'use client';

import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { API_CONFIG } from '@/lib/api/config';
import { Button, Container, Group, Stack, Text, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function WebSocketTestPage() {
  const [messages, setMessages] = useState<string[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [snapshotId, setSnapshotId] = useState('sna_47zXLjZSN4');
  const [tableId, setTableId] = useState('superheroes_a');
  const { user } = useScratchPadUser();

  useEffect(() => {
    // Create Socket.IO connection
    const newSocket = io(API_CONFIG.getApiUrl(), {
      transports: ['websocket'],
      path: '/snapshot-events',
      auth: {
        token: user?.websocketToken || user?.apiToken || '',
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

    newSocket.on('exception', (error) => {
      console.debug('Socket exception', error);
    });

    // Handly different messages:
    newSocket.on('pong', (data) => {
      console.debug('Received message:', data);
      setMessages((prev) => [...prev, typeof data === 'string' ? data : JSON.stringify(data)]);
    });

    newSocket.on('snapshot-event-subscription-confirmed', (data) => {
      setMessages((prev) => [...prev, typeof data === 'string' ? data : JSON.stringify(data)]);
    });

    newSocket.on('record-event-subscription-confirmed', (data) => {
      setMessages((prev) => [...prev, typeof data === 'string' ? data : JSON.stringify(data)]);
    });

    newSocket.on('snapshot-event', (data) => {
      setMessages((prev) => [...prev, typeof data === 'string' ? data : JSON.stringify(data)]);
    });

    newSocket.on('record-event', (data) => {
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

  const subscribeToSnapshot = (snapshotId: string, tableId: string) => {
    if (socket && isConnected) {
      socket.emit('subscribe-to-snapshot', {
        snapshotId,
        tableId,
      });
    }
  };

  return (
    <Container size="md">
      <Stack>
        <Text>Connection status: {isConnected ? 'Connected' : 'Disconnected'}</Text>
        <Button onClick={sendPing} disabled={!isConnected}>
          Send ping
        </Button>
        <Group gap="xs" grow align="flex-end">
          <TextInput label="Snapshot ID" value={snapshotId} onChange={(e) => setSnapshotId(e.target.value)} />
          <TextInput label="Table ID" value={tableId} onChange={(e) => setTableId(e.target.value)} />
          <Button onClick={() => subscribeToSnapshot(snapshotId, tableId)} disabled={!isConnected}>
            Subscribe to snapshot table
          </Button>
        </Group>
        <Text>Messages received:</Text>
        {messages.map((message, index) => (
          <Text key={index}>{message}</Text>
        ))}
      </Stack>
    </Container>
  );
}
