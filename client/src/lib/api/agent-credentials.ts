import { AiAgentCredential, CreateAiAgentCredentialDto, UpdateAiAgentCredentialDto } from "@/types/server-entities/agent-credentials";
import { API_CONFIG } from "./config";

export const agentCredentialsApi = {
  list: async (): Promise<AiAgentCredential[]> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/user/credentials`, {
      method: "GET",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) throw new Error("Failed to fetch agent credentials");
    return res.json();
  },
  create: async (data: CreateAiAgentCredentialDto): Promise<AiAgentCredential> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/user/credentials/new`, {
      method: "POST",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create agent credential");
    return res.json();
  },
  update: async (id: string, data: UpdateAiAgentCredentialDto): Promise<AiAgentCredential> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/user/credentials/${id}`, {
      method: "POST",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error("Failed to update agent credential");
    return res.json();
  },
  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/user/credentials/${id}`, {
      method: "DELETE",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    if (!res.ok) throw new Error("Failed to delete agent credential");
  },
};