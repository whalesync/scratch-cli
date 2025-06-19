'use client';

import { useState, useEffect } from 'react';
import { Container, Title, Text, Card, Button, Group, LoadingOverlay, TextInput, Stack, Badge } from '@mantine/core';
import { io } from 'socket.io-client';

interface Record {
  id: string;
  title: string;
}

// Create socket instance
const socket = io('http://localhost:3000', {
  transports: ['websocket'],
});

export default function Home() {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');

  const fetchRecords = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/records');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateRecord = async (id: string, title: string) => {
    try {
      const response = await fetch(`/api/records/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, title }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // The server will emit the update event, which will trigger a refresh
      setEditingId(null);
      setEditTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const response = await fetch(`/api/records/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // The server will emit the update event, which will trigger a refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const startEditing = (record: Record) => {
    setEditingId(record.id);
    setEditTitle(record.title);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const saveEdit = () => {
    if (editingId && editTitle.trim()) {
      updateRecord(editingId, editTitle.trim());
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchRecords();

    // Set up WebSocket listeners
    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    socket.on('recordsUpdated', () => {
      console.log('Records updated, refreshing...');
      fetchRecords();
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection error');
    });

    // Cleanup function
    return () => {
      socket.off('connect');
      socket.off('recordsUpdated');
      socket.off('error');
      socket.close();
    };
  }, []); // Empty dependency array since we want this to run once on mount

  return (
    <Container size="md" py="xl">
      <Title order={1} ta="center" mb="xl">
        Spinner Client - Records Management
      </Title>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <LoadingOverlay visible={loading} />
        
        <Title order={2} mb="md">
          Records List
        </Title>
        
        <Text mb="lg">
          Manage your records using the interface below.
        </Text>
        
        {error && (
          <Card withBorder p="md" mb="md" bg="red.0">
            <Text fw={500} mb="xs" c="red">Error:</Text>
            <Text c="red">{error}</Text>
          </Card>
        )}
        
        <Stack gap="md">
          {records.map((record) => (
            <Card key={record.id} withBorder p="md">
              {editingId === record.id ? (
                <Stack gap="sm">
                  <Group>
                    <Badge variant="light">ID: {record.id}</Badge>
                  </Group>
                  <TextInput
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Enter new title"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEditing();
                    }}
                  />
                  <Group>
                    <Button size="sm" onClick={saveEdit}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEditing}>
                      Cancel
                    </Button>
                  </Group>
                </Stack>
              ) : (
                <Group justify="space-between" align="center">
                  <div>
                    <Badge variant="light" mb="xs">ID: {record.id}</Badge>
                    <Text fw={500}>{record.title}</Text>
                  </div>
                  <Group gap="xs">
                    <Button size="sm" variant="outline" onClick={() => startEditing(record)}>
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      color="red" 
                      variant="outline" 
                      onClick={() => deleteRecord(record.id)}
                    >
                      Delete
                    </Button>
                  </Group>
                </Group>
              )}
            </Card>
          ))}
        </Stack>
        
        <Group mt="lg">
          <Button onClick={fetchRecords} loading={loading}>
            Refresh Records
          </Button>
        </Group>
      </Card>
    </Container>
  );
}
