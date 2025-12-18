import {
  AgentErrorResponse,
  CancelAgentRunResponse,
  ChatSession,
  CreateSessionResponse,
  DeleteSessionResponse,
  SendMessageResponse,
  SessionListResponse,
  WorkbookId,
} from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

/**
 * SDK for interacting with the Scratch Agent server (not the Scratch API) via rest endpoints
 */
export const agentApi = {
  listSessions: async (workbookId: WorkbookId): Promise<SessionListResponse> => {
    // Return empty array if JWT not set (no 401 error)
    // If we reload the snapshot page we fetch sessions right away,
    // so we need to return empty array if JWT not set and then force a reload
    if (!API_CONFIG.getAgentJwt()) {
      return { sessions: [] };
    }

    try {
      const axios = API_CONFIG.getAgentAxiosInstance();
      const res = await axios.get<SessionListResponse>(`/sessions/workbook/${workbookId}`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch agent sessions for current snapshot');
    }
  },

  createSession: async (workbookId: WorkbookId): Promise<CreateSessionResponse> => {
    try {
      const axios = API_CONFIG.getAgentAxiosInstance();
      const res = await axios.post<CreateSessionResponse>(`/sessions?workbook_id=${workbookId}`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to create agent session for snapshot');
    }
  },

  deleteSession: async (sessionId: string): Promise<DeleteSessionResponse> => {
    try {
      const axios = API_CONFIG.getAgentAxiosInstance();
      const res = await axios.delete<DeleteSessionResponse>(`/sessions/${sessionId}`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to delete agent session');
    }
  },

  getSession: async (sessionId: string): Promise<ChatSession> => {
    try {
      const axios = API_CONFIG.getAgentAxiosInstance();
      const res = await axios.get<ChatSession>(`/sessions/${sessionId}`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to load agent session');
    }
  },

  /**
   * Send a message to the agent
   * @deprecated - this api call is out of date since the move to websockets and needs to be revised before using it again
   */
  sendMessage: async (sessionId: string, payload: string): Promise<SendMessageResponse | AgentErrorResponse> => {
    try {
      const axios = API_CONFIG.getAgentAxiosInstance();
      const res = await axios.post<SendMessageResponse>(`/sessions/${sessionId}/messages`, payload);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to send message to agent');
    }
  },

  /**
   * Sends a message to the agent to try and cancel an existing agent run while it is processing through the LLM.
   * This message communciates outside of the websocket message system and is not part of the regular message flow.
   * @param sessionId - The ID of the session to cancel the agent run for
   * @param runId - The ID of the run to cancel
   */
  stopAgentRun: async (sessionId: string, taskId: string): Promise<CancelAgentRunResponse> => {
    try {
      const axios = API_CONFIG.getAgentAxiosInstance();
      const res = await axios.post<CancelAgentRunResponse>(`/sessions/${sessionId}/stop-agent-run/${taskId}`);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to cancel agent run');
    }
  },
};
