 
'use client';

import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { API_CONFIG } from '@/lib/api/config';
import { useSetState } from '@mantine/hooks';
import { useCallback, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface SnapshotEvent {
    type: 'snapshot-updated' | 'filter-changed';
    data: {
      tableId?: string;
      source: 'user' | 'agent';
    };
  }

export interface SnapshotRecordEvent {
    type: 'record-changes';
    data: {
      numRecords: number;
      changeType: 'suggested' | 'accepted';
      source: 'user' | 'agent';
    };
  }

export interface SnapshotEventWebhookProps {
  snapshotId: string;
  tableId: string;
  onSnapshotEvent?: (event: SnapshotEvent) => void;
  onRecordEvent?: (event: SnapshotRecordEvent) => void;
  onCloseConnection?: () => void;
}

export interface UseSnapshotEventWebhookReturn {
    isConnected: boolean;
    subscriptions: Subscriptions;
    sendPing: () => void;
    messageLog: string[];
    error: string | null;
}

type Subscriptions = {
    snapshot: boolean;
    tables: string[];
}

const log = (message: string, data?: unknown) => {
  console.debug(message, data);
}

export const useSnapshotEventWebhook = ({snapshotId, tableId, onSnapshotEvent, onRecordEvent, onCloseConnection}: SnapshotEventWebhookProps) : UseSnapshotEventWebhookReturn => {
 const {user} = useScratchPadUser();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [subscriptions, setSubscriptions] = useSetState<Subscriptions>({
    snapshot: false,
    tables: [],
  })
  const [messageLog, setMessageLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

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
      log('Socket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      log('Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      log('Socket connection error', error);
      setError(error.message);
    });

    newSocket.on('exception', (error) => {
      log('Socket exception', error);
      setError(error.message);
    });

    // Handly different messages:
    newSocket.on('pong', (data) => {
      log('Received message:', data);
      setMessageLog((prev) => [...prev, typeof data === 'string' ? data : JSON.stringify(data)]);
    });

    newSocket.on('snapshot-event-subscription-confirmed', (data) => {
        setMessageLog((prev) => [...prev, typeof data === 'string' ? data : JSON.stringify(data)]);
        setSubscriptions({snapshot: true});
    });

    newSocket.on('record-event-subscription-confirmed', (data) => {
        setMessageLog((prev) => [...prev, typeof data === 'string' ? data : JSON.stringify(data)]);
        setSubscriptions((current) => ({tables: [...current.tables, data.tableId]}));
    });

    newSocket.on('snapshot-event', (data) => {
        setMessageLog((prev) => [...prev, typeof data === 'string' ? data : JSON.stringify(data)]);
        onSnapshotEvent?.(data as SnapshotEvent);
    });

    newSocket.on('record-event', (data) => {
        setMessageLog((prev) => [...prev, typeof data === 'string' ? data : JSON.stringify(data)]);
        onRecordEvent?.(data as SnapshotRecordEvent);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
      onCloseConnection?.();
    };
  }, [user]);


  const subscribeToSnapshot = useCallback( (snapshotId: string) => {
    if (socket && isConnected) {
      socket.emit('subscribe-to-snapshot', {snapshotId});
    }
  }, [socket, isConnected]);

  const subscribeToRecords = useCallback((snapshotId: string, tableId: string) => {
    if (socket && isConnected) {
      socket.emit('subscribe-to-table', {snapshotId, tableId});
    }
  }, [socket, isConnected]);

  useEffect(() => {
    if (socket && isConnected) {
      subscribeToSnapshot(snapshotId);
      subscribeToRecords(snapshotId, tableId);
    }
  }, [socket, isConnected, snapshotId, tableId, subscribeToSnapshot, subscribeToRecords]);

  const sendPing = () => {
    if (socket && isConnected) {
      socket.emit('ping');
    }
  };

  return {
    isConnected,
    subscriptions,
    sendPing,
    messageLog,
    error,
  };
};