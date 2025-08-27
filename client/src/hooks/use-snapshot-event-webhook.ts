 
'use client';

import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { API_CONFIG } from '@/lib/api/config';
import { useSetState } from '@mantine/hooks';
import { useEffect, useState } from 'react';
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
      tableId: string;
      numRecords: number;
      changeType: 'suggested' | 'accepted';
      source: 'user' | 'agent';
    };
  }

export interface SubscriptionConfirmedEvent {
  snapshotId: string;
  tableId?: string;
  message: string;
}

export interface SnapshotEventWebhookProps {
  snapshotId: string;
  onSnapshotEvent?: (event: SnapshotEvent) => void;
  onRecordEvent?: (event: SnapshotRecordEvent) => void;
  onCloseConnection?: () => void;
  onError?: (error: Error) => void;
}

export interface UseSnapshotEventWebhookReturn {
    isConnected: boolean;
    subscriptions: Subscriptions;
    sendPing: () => void;
    messageLog: string[];
}

type Subscriptions = {
    snapshot: boolean;
    tables: string[];
}

const log = (message: string, data?: unknown) => {
  if(data) {
    console.debug('Snapshot Websocket Event:', message, data);
  } else {
    console.debug('Snapshot Websocket Event:', message);
  }
}



export const useSnapshotEventWebhook = (props: SnapshotEventWebhookProps) : UseSnapshotEventWebhookReturn => {
 const {
  snapshotId, 
  onSnapshotEvent, onRecordEvent, onCloseConnection, onError} = props;

 const {user} = useScratchPadUser();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [subscriptions, setSubscriptions] = useSetState<Subscriptions>({
    snapshot: false,
    tables: [],
  })
  const [messageLog, setMessageLog] = useState<string[]>([]);
  
  const addToMessageLog = (message: string) => {
    setMessageLog((prev: string[]) => [message, ...prev].slice(0, 30));
  }

  useEffect(() => {
    // Create Socket.IO connection
    const newSocket = io(API_CONFIG.getApiUrl(), {
      transports: ['websocket'],
      path: '/snapshot-events',
      auth: {
        token: user?.websocketToken || '',
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
      onError?.(error);
    });

    newSocket.on('exception', (error) => {
      log('Socket exception', error);
      addToMessageLog('Socket exception: ' + (error.message || 'Unknown error'));
      onError?.(error);
    });

    // Handly different messages:
    newSocket.on('pong', (data) => {
      log('Received message:', data);
      addToMessageLog(typeof data === 'string' ? data : JSON.stringify(data));
    });

    newSocket.on('snapshot-event-subscription-confirmed', (data) => {
      const confirmedEvent = data as SubscriptionConfirmedEvent;
        addToMessageLog(confirmedEvent.message);
        setSubscriptions({snapshot: true});
    });

    newSocket.on('record-event-subscription-confirmed', (data) => {
      const confirmedEvent = data as SubscriptionConfirmedEvent;
        addToMessageLog(confirmedEvent.message);
        const tableId = confirmedEvent.tableId;
        if(tableId) {
          setSubscriptions((current) => ({tables: [...current.tables, tableId]}));
        } 
    });

    newSocket.on('snapshot-event', (data) => {
        addToMessageLog(typeof data === 'string' ? data : JSON.stringify(data));
        onSnapshotEvent?.(data as SnapshotEvent);
    });

    newSocket.on('record-event', (data) => {
        addToMessageLog(typeof data === 'string' ? data : JSON.stringify(data));
        onRecordEvent?.(data as SnapshotRecordEvent);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
      onCloseConnection?.();
    };
  }, [user]);

  useEffect(() => {
    if (socket && isConnected) {
        socket.emit('subscribe', {snapshotId});
      }
    
  }, [socket, isConnected, snapshotId]);

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
  };
};