import { Snapshot } from "@/types/server-entities/snapshot";
import { API_CONFIG } from "./config";
import { ScratchpadApiError } from "./error";

export interface CreateContentSnapshotDto {
  name: string;
}

export const contentToolsApi = {
  createContentSnapshot: async (createDto: CreateContentSnapshotDto): Promise<Snapshot> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/tools/content-snapshot/create`, {
      method: "POST",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createDto),
    });
    if (!res.ok) throw new ScratchpadApiError("Failed to generate content snapshot", res.status, res.statusText);
    return res.json();
  },
};
