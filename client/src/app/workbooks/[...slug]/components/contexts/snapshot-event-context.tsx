'use client';

import { API_CONFIG } from '@/lib/api/config';
import { SWR_KEYS } from '@/lib/api/keys';
import { useSetState } from '@mantine/hooks';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSWRConfig } from 'swr';

interface SnapshotEventContextValue {
  isConnected: boolean;
  subscriptions: {
    snapshot: boolean;
    tables: string[];
  };
  sendPing: () => void;
  messageLog: MessageLogItem[];
}

export type MessageLogItem = {
  message: string;
  timestamp: Date;
};

const MESSAGE_LOG_MAX_LENGTH = 30;

interface SnapshotEventProviderProps {
  children: ReactNode;
  snapshotId: string;
}

const SnapshotEventContext = createContext<SnapshotEventContextValue | null>(null);

export const useSnapshotEventContext = () => {
  const context = useContext(SnapshotEventContext);
  if (!context) {
    throw new Error('useSnapshotEventContext must be used within a SnapshotEventProvider');
  }
  return context;
};

export const SnapshotEventProvider = ({ children, snapshotId }: SnapshotEventProviderProps) => {
  const { mutate: globalMutate } = useSWRConfig();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [subscriptions, setSubscriptions] = useSetState<Subscriptions>({
    snapshot: false,
    tables: [],
  });
  const [messageLog, setMessageLog] = useState<MessageLogItem[]>([]);

  const addToMessageLog = (message: string) => {
    setMessageLog((prev: MessageLogItem[]) =>
      [{ message, timestamp: new Date() }, ...prev].slice(0, MESSAGE_LOG_MAX_LENGTH),
    );
  };

  // Handle snapshot events (snapshot-updated, filter-changed)
  const handleSnapshotEvent = useCallback(
    (event: SnapshotEvent) => {
      console.debug('Snapshot event received:', event);

      if (event.type === 'snapshot-updated' || event.type === 'filter-changed') {
        addToMessageLog('Mutate snapshot SWR keys');
        // Invalidate snapshot detail cache
        globalMutate(SWR_KEYS.snapshot.detail(snapshotId));
        globalMutate(SWR_KEYS.snapshot.list());

        if (event.data.tableId) {
          globalMutate(SWR_KEYS.snapshot.recordsKeyMatcher(snapshotId, event.data.tableId), undefined, {
            revalidate: true,
          });
        }
      }
    },
    [snapshotId, globalMutate],
  );

  // Handle record events (record-changes)
  const handleRecordEvent = useCallback(
    (event: SnapshotRecordEvent) => {
      console.debug('Record event received:', event);

      if (event.type === 'record-changes' && event.data.tableId) {
        addToMessageLog('Mutate record SWR keys');
        globalMutate(SWR_KEYS.snapshot.recordsKeyMatcher(snapshotId, event.data.tableId), undefined, {
          revalidate: true,
        });
      }
    },
    [snapshotId, globalMutate],
  );

  useEffect(() => {
    // Create Socket.IO connection
    const newSocket = io(API_CONFIG.getApiUrl(), {
      transports: ['websocket'],
      path: '/snapshot-events',
      auth: {
        token: API_CONFIG.getSnapshotWebsocketToken(),
      },
      // Configure timeouts to be more resilient to browser throttling
      timeout: 60000, // 60 seconds - increased from default 20s
      // Enable reconnection with exponential backoff
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      log('connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason, description) => {
      log('disconnected', { reason, description });
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      log('connection error', error);
    });

    newSocket.on('exception', (error) => {
      log('exception', error);
      addToMessageLog('Socket exception: ' + (error.message || 'Unknown error'));
    });

    // Handly different messages:
    newSocket.on('pong', (data) => {
      log('Received message:', data);
      addToMessageLog(typeof data === 'string' ? data : JSON.stringify(data));
    });

    newSocket.on('snapshot-event-subscription-confirmed', (data) => {
      const confirmedEvent = data as SubscriptionConfirmedEvent;
      addToMessageLog(confirmedEvent.message);
      setSubscriptions({ snapshot: true });
    });

    newSocket.on('record-event-subscription-confirmed', (data) => {
      const confirmedEvent = data as SubscriptionConfirmedEvent;
      addToMessageLog(confirmedEvent.message);
      const tableId = confirmedEvent.tableId;
      if (tableId) {
        setSubscriptions((current) => ({ tables: [...current.tables, tableId] }));
      }
    });

    newSocket.on('snapshot-event', (data) => {
      addToMessageLog(typeof data === 'string' ? data : JSON.stringify(data));
      handleSnapshotEvent?.(data as SnapshotEvent);
    });

    newSocket.on('record-event', (data) => {
      addToMessageLog(typeof data === 'string' ? data : JSON.stringify(data));
      handleRecordEvent?.(data as SnapshotRecordEvent);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [handleRecordEvent, handleSnapshotEvent, setSubscriptions]); // Only depend on the websocket token, not the entire user object

  useEffect(() => {
    if (socket && isConnected) {
      socket.emit('subscribe', { snapshotId });
    }
  }, [socket, isConnected, snapshotId]);

  const sendPing = () => {
    if (socket && isConnected) {
      socket.emit('ping');
    }
  };

  const value: SnapshotEventContextValue = {
    isConnected,
    subscriptions,
    sendPing,
    messageLog,
  };

  return <SnapshotEventContext.Provider value={value}>{children}</SnapshotEventContext.Provider>;
};

type Subscriptions = {
  snapshot: boolean;
  tables: string[];
};

const log = (message: string, data?: unknown) => {
  if (data) {
    console.debug('Snapshot Websocket Event:', message, data);
  } else {
    console.debug('Snapshot Websocket Event:', message);
  }
};

export interface SnapshotEvent {
  type: 'snapshot-updated' | 'filter-changed' | 'page-size-changed';
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
    changeType: 'suggested' | 'accepted' | 'rejected';
    source: 'user' | 'agent';
  };
}

export interface SubscriptionConfirmedEvent {
  snapshotId: string;
  tableId?: string;
  message: string;
}
