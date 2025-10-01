import { CreateCustomConnectorDto, CustomConnector } from "@/types/server-entities/custom-connector";
import { API_CONFIG } from "./config";
import { checkForApiError } from "./error";

export const customConnectorApi = {
  list: async (): Promise<CustomConnector[]> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/custom-connectors`, {
      method: "GET",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    await checkForApiError(res, "Failed to fetch custom connectors");
    return res.json();
  },

  detail: async (connectorId: string): Promise<CustomConnector> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/custom-connectors/${connectorId}`, {
      method: "GET",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    await checkForApiError(res, "Failed to fetch custom connector");
    return res.json();
  },

  create: async (dto: CreateCustomConnectorDto): Promise<CustomConnector> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/custom-connectors`, {
      method: "POST",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...dto }),
    });
    await checkForApiError(res, "Failed to create custom connector");
    return res.json();
  },

  update: async (connectorId: string, dto: CreateCustomConnectorDto): Promise<CustomConnector> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/custom-connectors/${connectorId}`, {
      method: "PUT",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...dto }),
    });
    await checkForApiError(res, "Failed to update custom connector");
    return res.json();
  },

  delete: async (connectorId: string): Promise<void> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/custom-connectors/${connectorId}`, {
      method: "DELETE",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    await checkForApiError(res, "Failed to delete custom connector");
  },
}; 