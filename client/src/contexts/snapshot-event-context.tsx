'use client';

import { SnapshotEvent, SnapshotRecordEvent, useSnapshotEventWebhook } from '@/hooks/use-snapshot-event-webhook';
import { SWR_KEYS } from '@/lib/api/keys';
import { createContext, ReactNode, useCallback, useContext } from 'react';
import { useSWRConfig } from 'swr';

interface SnapshotEventContextValue {
  isConnected: boolean;
  subscriptions: {
    snapshot: boolean;
    tables: string[];
  };
  sendPing: () => void;
  messageLog: string[];
}

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

  // Handle snapshot events (snapshot-updated, filter-changed)
  const handleSnapshotEvent = useCallback(
    (event: SnapshotEvent) => {
      console.debug('Snapshot event received:', event);

      if (event.type === 'snapshot-updated' || event.type === 'filter-changed') {
        // Invalidate snapshot detail cache
        globalMutate(SWR_KEYS.snapshot.detail(snapshotId));
        globalMutate(SWR_KEYS.snapshot.list('all'));

        if (event.data.tableId) {
          const key = SWR_KEYS.snapshot.records(snapshotId, event.data.tableId);
          globalMutate(key);
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
        // Invalidate records for the specific table
        globalMutate(SWR_KEYS.snapshot.records(snapshotId, event.data.tableId));
      }
    },
    [snapshotId, globalMutate],
  );

  // Handle websocket errors
  const handleError = useCallback((error: Error) => {
    console.error('Websocket error in SnapshotEventProvider:', error);
  }, []);

  // Handle connection close
  const handleCloseConnection = useCallback(() => {
    console.debug('Websocket connection closed in SnapshotEventProvider');
  }, []);

  // Use the websocket hook
  // TODO - we could probably merge the hook into this context
  const { isConnected, subscriptions, sendPing, messageLog } = useSnapshotEventWebhook({
    snapshotId,
    onSnapshotEvent: handleSnapshotEvent,
    onRecordEvent: handleRecordEvent,
    onError: handleError,
    onCloseConnection: handleCloseConnection,
  });

  const value: SnapshotEventContextValue = {
    isConnected,
    subscriptions,
    sendPing,
    messageLog,
  };

  return <SnapshotEventContext.Provider value={value}>{children}</SnapshotEventContext.Provider>;
};
