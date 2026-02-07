'use client';

import { API_CONFIG } from '@/lib/api/config';
import { SWR_KEYS } from '@/lib/api/keys';
import {
  MessageLogItem,
  SubscriptionConfirmedEvent,
  Subscriptions,
  WorkbookTableEvent,
  WorkbookTableRecordEvent,
} from '@/types/workbook-websocket';
import { WorkbookId } from '@spinner/shared-types';
import { io, Socket } from 'socket.io-client';
import { mutate } from 'swr';
import { create } from 'zustand';

/**
 * A Zustand store that manages Socket.IO connections to the Workbook WebSocket service as a singleton,
 * ensuring stable connections across component lifecycles.
 *
 * - Singleton Socket: One Socket.IO connection shared across all components
 * - Automatic Reconnection: Built-in Socket.IO reconnection with exponential backoff
 * - Message History: Centralized event message log for debugging
 * - Workbook Subscriptions: Subscribe to snapshot and table events per workbook
 */

type State = {
  socket: Socket | null;
  isConnected: boolean;
  subscriptions: Subscriptions;
  messageLog: MessageLogItem[];
  currentWorkbookId: WorkbookId | null;
};

type Actions = {
  connect: (workbookId: WorkbookId) => void;
  disconnect: () => void;
  sendPing: () => void;
  _addToMessageLog: (message: string) => void;
  _setSubscriptions: (subscriptions: Partial<Subscriptions>) => void;
  _handleSnapshotEvent: (event: WorkbookTableEvent, workbookId: WorkbookId) => void;
  _handleRecordEvent: (event: WorkbookTableRecordEvent, workbookId: WorkbookId) => void;
};

type WorkbookWebSocketStore = State & Actions;

const MESSAGE_LOG_MAX_LENGTH = 30;

const log = (message: string, data?: unknown) => {
  if (data) {
    console.debug('Workbook Websocket Event:', message, data);
  } else {
    console.debug('Workbook Websocket Event:', message);
  }
};

export const useWorkbookWebSocketStore = create<WorkbookWebSocketStore>((set, get) => ({
  // Initial state
  socket: null,
  isConnected: false,
  subscriptions: {
    workbook: false,
    tables: [],
  },
  messageLog: [],
  currentWorkbookId: null,

  _addToMessageLog: (message: string) => {
    set((state) => ({
      messageLog: [{ message, timestamp: new Date() }, ...state.messageLog].slice(0, MESSAGE_LOG_MAX_LENGTH),
    }));
  },

  _setSubscriptions: (updates: Partial<Subscriptions>) => {
    set((state) => ({
      subscriptions: {
        ...state.subscriptions,
        ...updates,
      },
    }));
  },

  _handleSnapshotEvent: (event: WorkbookTableEvent, workbookId: WorkbookId) => {
    console.debug('Snapshot event received:', event);

    if (event.type === 'workbook-updated' || event.type === 'filter-changed') {
      get()._addToMessageLog('Mutate snapshot SWR keys');

      // Invalidate snapshot detail cache
      mutate(SWR_KEYS.workbook.detail(workbookId), undefined, {
        revalidate: true,
      });
      mutate(SWR_KEYS.workbook.list());

      if (event.data.tableId) {
        mutate(SWR_KEYS.workbook.recordsKeyMatcher(workbookId, event.data.tableId), undefined, {
          revalidate: true,
        });
      }
    }
  },

  _handleRecordEvent: (event: WorkbookTableRecordEvent, workbookId: WorkbookId) => {
    console.debug('Record event received:', event);

    if (event.type === 'record-changes' && event.data.tableId) {
      get()._addToMessageLog('Mutate record SWR keys');
      mutate(SWR_KEYS.workbook.recordsKeyMatcher(workbookId, event.data.tableId), undefined, {
        revalidate: true,
      });
    }
  },

  connect: (workbookId: WorkbookId) => {
    const state = get();

    // If already connected to the same workbook, do nothing
    if (state.socket && state.isConnected && state.currentWorkbookId === workbookId) {
      console.debug('Already connected to workbook:', workbookId);
      return;
    }

    // Disconnect existing socket if connecting to a different workbook
    if (state.socket && state.currentWorkbookId !== workbookId) {
      console.debug('Disconnecting from previous workbook:', state.currentWorkbookId);
      state.socket.disconnect();
    }

    console.debug('Creating Socket.IO connection for workbook:', workbookId);

    // Create Socket.IO connection
    const newSocket = io(API_CONFIG.getApiUrl(), {
      transports: ['websocket'],
      path: '/workbook-events',
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
      set({ isConnected: true });

      // Subscribe to workbook events when connected
      newSocket.emit('subscribe', { workbookId });
    });

    newSocket.on('disconnect', (reason, description) => {
      log('disconnected', { reason, description });
      set({
        isConnected: false,
        subscriptions: { workbook: false, tables: [] },
      });
    });

    newSocket.on('connect_error', (error) => {
      log('connection error', error);
    });

    newSocket.on('exception', (error) => {
      log('exception', error);
      get()._addToMessageLog('Socket exception: ' + (error.message || 'Unknown error'));
    });

    // Handle different messages:
    newSocket.on('pong', (data) => {
      log('Received message:', data);
      get()._addToMessageLog(typeof data === 'string' ? data : JSON.stringify(data));
    });

    newSocket.on('snapshot-event-subscription-confirmed', (data) => {
      const confirmedEvent = data as SubscriptionConfirmedEvent;
      get()._addToMessageLog(confirmedEvent.message);
      get()._setSubscriptions({ workbook: true });
    });

    newSocket.on('record-event-subscription-confirmed', (data) => {
      const confirmedEvent = data as SubscriptionConfirmedEvent;
      get()._addToMessageLog(`${confirmedEvent.message}: ${confirmedEvent.tableId}`);
      const tableId = confirmedEvent.tableId;
      if (tableId) {
        set((state) => ({
          subscriptions: {
            ...state.subscriptions,
            tables: [...state.subscriptions.tables, tableId],
          },
        }));
      }
    });

    newSocket.on('snapshot-event', (data) => {
      get()._addToMessageLog(typeof data === 'string' ? data : JSON.stringify(data));
      get()._handleSnapshotEvent(data as WorkbookTableEvent, workbookId);
    });

    newSocket.on('record-event', (data) => {
      get()._addToMessageLog(typeof data === 'string' ? data : JSON.stringify(data));
      get()._handleRecordEvent(data as WorkbookTableRecordEvent, workbookId);
    });

    set({
      socket: newSocket,
      currentWorkbookId: workbookId,
      messageLog: [], // Clear message log when connecting to new workbook
      subscriptions: { workbook: false, tables: [] },
    });
  },

  disconnect: () => {
    const state = get();
    console.debug('Disconnecting Socket.IO');

    if (state.socket) {
      state.socket.disconnect();
      set({
        socket: null,
        isConnected: false,
        currentWorkbookId: null,
        subscriptions: { workbook: false, tables: [] },
      });
    }
  },

  sendPing: () => {
    const state = get();
    if (state.socket && state.isConnected) {
      state.socket.emit('ping');
    }
  },
}));

// Selector hooks for optimized re-renders
export const useWorkbookWebSocketConnection = () =>
  useWorkbookWebSocketStore((state) => ({
    isConnected: state.isConnected,
    subscriptions: state.subscriptions,
  }));

export const useWorkbookWebSocketMessageLog = () => useWorkbookWebSocketStore((state) => state.messageLog);

export const useWorkbookWebSocketActions = () =>
  useWorkbookWebSocketStore((state) => ({
    sendPing: state.sendPing,
    connect: state.connect,
    disconnect: state.disconnect,
  }));
