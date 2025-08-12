import { contentToolsApi } from "@/lib/api/content-tools";
import { Snapshot } from "@/types/server-entities/snapshot";

export const useContentTools = () => {
  const createContentSnapshot = async (name: string): Promise<Snapshot> => {
      return contentToolsApi.createContentSnapshot({ name });
  };

  return {
    createContentSnapshot,
  };
};
