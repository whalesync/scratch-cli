'use client';

import { aiAgentApi } from '@/lib/api/ai-agent';
import {
  ChatMessage,
  ChatSession,
  ChatSessionSummary,
  CreateSessionResponse,
} from '@/types/server-entities/chat-session';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

interface AIAgentSessionManagerContextValue {
  sessions: ChatSessionSummary[];
  isLoadingSessions: boolean;
  loadSessionListError: string | null;
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  activateSession: (sessionId: string) => Promise<void>;
  clearActiveSession: () => void;
  addToActiveChatHistory: (message: ChatMessage) => void;
  createSession: (snapshotId: string) => Promise<CreateSessionResponse>;
  deleteSession: (sessionId: string) => Promise<void>;
  refreshActiveSession: () => Promise<void>;
}

interface AIAgentSessionManagerProviderProps {
  children: ReactNode;
}

const AIAgentSessionManagerContext = createContext<AIAgentSessionManagerContextValue | null>(null);

export const useAIAgentSessionManagerContext = () => {
  const context = useContext(AIAgentSessionManagerContext);
  if (!context) {
    throw new Error('useAIAgentSessionManagerContext must be used within an AIAgentSessionManagerProvider');
  }
  return context;
};

export const AIAgentSessionManagerProvider = ({ children }: AIAgentSessionManagerProviderProps) => {
  const [initialized, setInitialized] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [loadSessionListError, setLoadSessionListError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);

  const loadSessionList = useCallback(async () => {
    if (isLoadingSessions) return; // Prevent multiple simultaneous loads

    setIsLoadingSessions(true);
    try {
      const data = await aiAgentApi.listSessions();
      setSessions(data.sessions);
    } catch (error) {
      setLoadSessionListError('Failed to load sessions');
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [isLoadingSessions]);

  // Load sessions on mount
  useEffect(() => {
    if (!initialized) {
      console.log('Loading sessions');
      loadSessionList();
      setInitialized(true);
    }
  }, [initialized, loadSessionList]);

  const createSession = useCallback(
    async (snapshotId: string) => {
      const { session: newSession, available_capabilities } = await aiAgentApi.createSession(snapshotId);

      setSessions([...sessions, newSession]);
      setActiveSessionId(newSession.id);

      const fullSession = await aiAgentApi.getSession(newSession.id);
      setActiveSession(fullSession);

      return {
        session: newSession,
        available_capabilities,
      };
    },
    [sessions, setSessions, setActiveSessionId],
  );

  const activateSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    const session = await aiAgentApi.getSession(sessionId);
    setActiveSession(session);
  }, []);

  const refreshActiveSession = useCallback(async () => {
    if (activeSessionId) {
      const updatedSession = await aiAgentApi.getSession(activeSessionId);
      setActiveSession(updatedSession);
      // Update the session in the list
      setSessions([...sessions.filter((s) => s.id !== activeSessionId), updatedSession]);
    }
  }, [activeSessionId, sessions]);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await aiAgentApi.deleteSession(sessionId);
      } catch (error) {
        console.log('Error deleting session from server:', sessionId, error);
      }
      setSessions(sessions.filter((session) => session.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
    },
    [sessions, activeSessionId],
  );

  const addToActiveChatHistory = useCallback(
    (message: ChatMessage) => {
      if (activeSession) {
        setActiveSession({ ...activeSession, chat_history: [...activeSession.chat_history, message] });
      }
    },
    [activeSession],
  );

  const clearActiveSession = useCallback(() => {
    setActiveSession(null);
    setActiveSessionId(null);
  }, []);

  const contextValue: AIAgentSessionManagerContextValue = {
    sessions,
    isLoadingSessions,
    loadSessionListError,
    activeSession,
    activeSessionId,
    activateSession,
    createSession,
    deleteSession,
    refreshActiveSession,
    addToActiveChatHistory,
    clearActiveSession,
  };

  return <AIAgentSessionManagerContext.Provider value={contextValue}>{children}</AIAgentSessionManagerContext.Provider>;
};
