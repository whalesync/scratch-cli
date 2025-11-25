import {
  AgentErrorResponse,
  CancelAgentRunResponse,
  ChatSession,
  CreateSessionResponse,
  DeleteSessionResponse,
  SendMessageResponse,
  SessionListResponse,
} from '@/types/server-entities/agent';
import { WorkbookId } from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { ScratchpadApiError } from './error';

/**
 * SDK for interacting with the Scratch Agent server (not the Scratch API) via rest endpoints
 */
export const aiAgentApi = {
  listSessions: async (workbookId: WorkbookId): Promise<SessionListResponse> => {
    // Return empty array if JWT not set (no 401 error)
    // If we reload the snapshot page we fetch sessions right away,
    // so we need to return empty array if JWT not set and then force a reload
    if (!API_CONFIG.getAgentJwt()) {
      return { sessions: [] };
    }

    const res = await fetch(`${API_CONFIG.getAiAgentApiUrl()}/sessions/workbook/${workbookId}`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAiAgentAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new ScratchpadApiError(
        res.statusText ?? 'Failed to fetch agent sessions for current snapshot',
        res.status,
        res.statusText,
      );
    }
    return res.json();
  },

  createSession: async (workbookId: WorkbookId): Promise<CreateSessionResponse> => {
    const res = await fetch(`${API_CONFIG.getAiAgentApiUrl()}/sessions?workbook_id=${workbookId}`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAiAgentAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new ScratchpadApiError(
        res.statusText ?? 'Failed to create agent session for snapshot',
        res.status,
        res.statusText,
      );
    }
    return res.json();
  },

  deleteSession: async (sessionId: string): Promise<DeleteSessionResponse> => {
    const res = await fetch(`${API_CONFIG.getAiAgentApiUrl()}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        ...API_CONFIG.getAiAgentAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to delete agent session', res.status, res.statusText);
    }
    return res.json();
  },

  getSession: async (sessionId: string): Promise<ChatSession> => {
    const res = await fetch(`${API_CONFIG.getAiAgentApiUrl()}/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAiAgentAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to load agent session', res.status, res.statusText);
    }
    return res.json();
  },

  /**
   * Send a message to the agent
   * @deprecated - this api call is out of date since the move to websockets and needs to be revised before using it again
   */
  sendMessage: async (sessionId: string, payload: string): Promise<SendMessageResponse | AgentErrorResponse> => {
    const res = await fetch(`${API_CONFIG.getAiAgentApiUrl()}/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAiAgentAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: payload,
    });

    if (!res.ok) {
      try {
        const errorResponse = (await res.json()) as { detail: string };
        return {
          type: 'agent_error',
          detail: errorResponse.detail,
        };
      } catch (error) {
        console.log('Failed to parse error response from Agent', error);
      }
      throw new ScratchpadApiError(res.statusText ?? 'Failed to send message to agent', res.status, res.statusText);
    }

    return (await res.json()) as SendMessageResponse;
  },

  /**
   * Sends a message to the agent to try and cancel an existing agent run while it is processing through the LLM.
   * This message communciates outside of the websocket message system and is not part of the regular message flow.
   * @param sessionId - The ID of the session to cancel the agent run for
   * @param runId - The ID of the run to cancel
   */
  cancelAgentRun: async (sessionId: string, runId: string): Promise<CancelAgentRunResponse> => {
    const res = await fetch(`${API_CONFIG.getAiAgentApiUrl()}/sessions/${sessionId}/cancel-agent-run/${runId}`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAiAgentAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? 'Failed to cancel agent run', res.status, res.statusText);
    }
    return res.json();
  },
};
