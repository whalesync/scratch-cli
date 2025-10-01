import { Snapshot } from "@/types/server-entities/snapshot";
import { API_CONFIG } from "./config";
import { checkForApiError } from "./error";

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
    await checkForApiError(res, "Failed to generate content snapshot");
    return res.json();
  },
};
