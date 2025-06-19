'use client';

import { useState, useEffect } from 'react';
import { Container, Title, Text } from '@mantine/core';
import { io } from 'socket.io-client';
import RecordsGrid from './components/RecordsGrid';

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
      const response = await fetch(`/api/records`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ id, title }]),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // The server will emit the update event, which will trigger a refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const response = await fetch(`/api/records`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([id]),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // The server will emit the update event, which will trigger a refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
    <Container size="xl" py="xl">
      <Title order={1} ta="center" mb="xl">
        Records Management
      </Title>

      {error && (
        <Text color="red" size="sm" mb="md">
          {error}
        </Text>
      )}

      <RecordsGrid
        records={records}
        onUpdate={updateRecord}
        onDelete={deleteRecord}
      />
      {loading && (
        <Text ta="center" mt="md">
          Loading...
        </Text>
      )}
    </Container>
  );
}
