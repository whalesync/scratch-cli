import { CreateGenericTableDto, GenericTable } from "@/types/server-entities/generic-table";
import { API_CONFIG } from "./config";
import { checkForApiError } from "./error";

export const genericTableApi = {
  list: async (): Promise<GenericTable[]> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/generic-tables`, {
      method: "GET",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    await checkForApiError(res, "Failed to fetch generic tables");
    return res.json();
  },

  detail: async (tableId: string): Promise<GenericTable> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/generic-tables/${tableId}`, {
      method: "GET",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    await checkForApiError(res, "Failed to fetch generic table");
    return res.json();
  },

  create: async (dto: CreateGenericTableDto): Promise<GenericTable> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/generic-tables`, {
      method: "POST",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...dto }),
    });
    await checkForApiError(res, "Failed to create generic table");
    return res.json();
  },

  update: async (tableId: string, dto: CreateGenericTableDto): Promise<GenericTable> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/generic-tables/${tableId}`, {
      method: "PUT",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...dto }),
    });
    await checkForApiError(res, "Failed to update generic table");
    return res.json();
  },

  delete: async (tableId: string): Promise<void> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/generic-tables/${tableId}`, {
      method: "DELETE",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    await checkForApiError(res, "Failed to delete generic table");
  },
}; 