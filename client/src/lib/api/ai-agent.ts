import { AgentErrorResponse, ChatSession, CreateSessionResponse, DeleteSessionResponse, SendMessageResponse, SessionListResponse } from "@/types/server-entities/chat-session";
import { API_CONFIG } from "./config";

export const aiAgentApi = {
  listSessions: async (): Promise<SessionListResponse> => {
    const res = await fetch(`${API_CONFIG.getAiAgentApiUrl()}/sessions`, {
      method: "GET",
      headers: {
        ...API_CONFIG.getAiAgentAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? "Failed to fetch agent sessions");
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
      throw new Error(res.statusText ?? "Failed to create agent session for snapshot");
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
      throw new Error(res.statusText ?? "Failed to delete agent session");
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
      throw new Error(res.statusText ?? "Failed to load agent session");
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
      throw new Error(res.statusText ?? "Failed to send message to agent");
    }

    return (await res.json()) as SendMessageResponse;
  },
};