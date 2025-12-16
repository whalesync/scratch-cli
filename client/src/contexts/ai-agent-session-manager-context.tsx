'use client';

import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { agentApi } from '@/lib/api/agent';
import { SWR_KEYS } from '@/lib/api/keys';
import { ChatMessage, ChatSession, ChatSessionSummary, CreateSessionResponse, WorkbookId } from '@spinner/shared-types';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import useSWR from 'swr';

interface AIAgentSessionManagerContextValue {
  sessions: ChatSessionSummary[];
  isLoadingSessions: boolean;
  loadSessionListError: string | null;
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  activateSession: (sessionId: string) => Promise<void>;
  clearActiveSession: () => void;
  addToActiveChatHistory: (message: ChatMessage) => void;
  createSession: (workbookId: WorkbookId) => Promise<CreateSessionResponse>;
  deleteSession: (sessionId: string) => Promise<void>;
  refreshActiveSession: () => Promise<void>;
  cancelAgentRun: (runId: string) => Promise<string | undefined>;
  refreshSessions: () => Promise<void>;
}

interface AIAgentSessionManagerProviderProps {
  children: ReactNode;
  workbookId: WorkbookId;
}

const AIAgentSessionManagerContext = createContext<AIAgentSessionManagerContextValue | null>(null);

export const useAIAgentSessionManagerContext = () => {
  const context = useContext(AIAgentSessionManagerContext);
  if (!context) {
    throw new Error('useAIAgentSessionManagerContext must be used within an AIAgentSessionManagerProvider');
  }
  return context;
};

export const AIAgentSessionManagerProvider = ({ workbookId, children }: AIAgentSessionManagerProviderProps) => {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  // Get user data to check for agentJwt availability
  const { user, isLoading: isLoadingUser } = useScratchPadUser();

  const {
    data: sessionListResponse,
    error: loadSessionListError,
    isLoading: isLoadingSessions,
    mutate: refreshSessions,
  } = useSWR(SWR_KEYS.agentSessions.list(workbookId), () => agentApi.listSessions(workbookId), {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  // Trigger session reload when agentJwt becomes available
  useEffect(() => {
    if (!isLoadingUser && user?.agentJwt) {
      refreshSessions();
    }
  }, [isLoadingUser, user?.agentJwt, refreshSessions]);

  useEffect(() => {
    const reloadSession = async () => {
      if (activeSessionId) {
        // reload the session when sessions change
        const fullSession = await agentApi.getSession(activeSessionId);
        setActiveSession(fullSession);
      }
    };
    reloadSession().catch((error) => {
      console.error('Error reloading session:', error);
    });
  }, [activeSessionId, sessionListResponse]);

  const createSession = useCallback(
    async (workbookId: WorkbookId) => {
      const { session: newSession, available_capabilities } = await agentApi.createSession(workbookId);
      await refreshSessions();

      setActiveSessionId(newSession.id);

      const fullSession = await agentApi.getSession(newSession.id);
      setActiveSession(fullSession);

      return {
        session: newSession,
        available_capabilities,
      };
    },
    [refreshSessions, setActiveSessionId],
  );

  const activateSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    const session = await agentApi.getSession(sessionId);
    setActiveSession(session);
  }, []);

  const refreshActiveSession = useCallback(async () => {
    if (activeSessionId) {
      const updatedSession = await agentApi.getSession(activeSessionId);
      setActiveSession(updatedSession);
      await refreshSessions();
    }
  }, [activeSessionId, refreshSessions]);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await agentApi.deleteSession(sessionId);
        await refreshSessions();
      } catch (error) {
        console.log('Error deleting session from server:', sessionId, error);
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
    },
    [activeSessionId, refreshSessions],
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

  const cancelAgentRun = useCallback(
    async (runId: string): Promise<string | undefined> => {
      try {
        if (!activeSessionId) {
          console.log('No active session - unable to cancel agent run');
          return;
        }
        const response = await agentApi.cancelAgentRun(activeSessionId, runId);
        return response.message;
      } catch (error) {
        console.log('Error cancelling agent run:', error);
        return 'Failed to cancel agent run';
      }
    },
    [activeSessionId],
  );

  const contextValue: AIAgentSessionManagerContextValue = {
    sessions: sessionListResponse?.sessions ?? [],
    isLoadingSessions: isLoadingSessions || isLoadingUser,
    loadSessionListError,
    activeSession,
    activeSessionId,
    activateSession,
    createSession,
    deleteSession,
    refreshActiveSession,
    addToActiveChatHistory,
    clearActiveSession,
    cancelAgentRun,
    refreshSessions: async () => {
      await refreshSessions();
    },
  };

  return <AIAgentSessionManagerContext.Provider value={contextValue}>{children}</AIAgentSessionManagerContext.Provider>;
};
