import { AgentErrorResponse, CancelAgentRunResponse, ChatSession, CreateSessionResponse, DeleteSessionResponse, SendMessageResponse, SessionListResponse } from "@/types/server-entities/chat-session";
import { API_CONFIG } from "./config";
import { ScratchpadApiError } from "./error";

export const aiAgentApi = {
  listSessions: async (snapshotId: string): Promise<SessionListResponse> => {
    // Return empty array if JWT not set (no 401 error)
    // If we reload the snapshot page we fetch sessions right away,
    // so we need to return empty array if JWT not set and then force a reload
    if (!API_CONFIG.getAgentJwt()) {
      return { sessions: [] };
    }
    
    const res = await fetch(`${API_CONFIG.getAiAgentApiUrl()}/sessions/snapshot/${snapshotId}`, {
      method: "GET",
      headers: {
        ...API_CONFIG.getAiAgentAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? "Failed to fetch agent sessions for current snapshot", res.status, res.statusText);
    }
    return res.json();
  },

  createSession: async (snapshotId: string): Promise<CreateSessionResponse> => {
    const res = await fetch(`${API_CONFIG.getAiAgentApiUrl()}/sessions?snapshot_id=${snapshotId}`, {
      method: "POST",
      headers: {
        ...API_CONFIG.getAiAgentAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? "Failed to create agent session for snapshot", res.status, res.statusText);
    }
    return res.json();
  },
  
  deleteSession: async (sessionId: string): Promise<DeleteSessionResponse> => {
    const res = await fetch(`${API_CONFIG.getAiAgentApiUrl()}/sessions/${sessionId}`, {
      method: "DELETE",
      headers: {
        ...API_CONFIG.getAiAgentAuthHeaders(),
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? "Failed to delete agent session", res.status, res.statusText);
    }
    return res.json();
  },

  getSession: async (sessionId: string): Promise<ChatSession> => {
    const res = await fetch(`${API_CONFIG.getAiAgentApiUrl()}/sessions/${sessionId}`, {
      method: "GET",
      headers: {
        ...API_CONFIG.getAiAgentAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? "Failed to load agent session", res.status, res.statusText);
    }
    return res.json();
  },
  
  sendMessage: async (sessionId: string, payload: string): Promise<SendMessageResponse | AgentErrorResponse> => {
    const res = await fetch(`${API_CONFIG.getAiAgentApiUrl()}/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: {
        ...API_CONFIG.getAiAgentAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: payload,
    });

    if (!res.ok) {
      try{
        const errorResponse = (await res.json()) as {detail: string};
        return {
          type: 'agent_error',
          detail: errorResponse.detail,
        };
      } catch (error) {
        console.log("Failed to parse error response from Agent", error);
      }
      throw new ScratchpadApiError(res.statusText ?? "Failed to send message to agent", res.status, res.statusText);
    }

    return (await res.json()) as SendMessageResponse;
  },

  cancelAgentRun: async (sessionId: string, runId: string): Promise<CancelAgentRunResponse> => {
    const res = await fetch(`${API_CONFIG.getAiAgentApiUrl()}/sessions/${sessionId}/cancel-agent-run/${runId}`, {
      method: "POST",
      headers: {
        ...API_CONFIG.getAiAgentAuthHeaders(),
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? "Failed to cancel agent run", res.status, res.statusText);
    }
    return res.json();
  },
};