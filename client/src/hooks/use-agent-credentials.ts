import { agentCredentialsApi } from "@/lib/api/agent-credentials";
import { SWR_KEYS } from "@/lib/api/keys";
import { CreateAiAgentCredentialDto, UpdateAiAgentCredentialDto } from "@/types/server-entities/agent-credentials";
import { useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useScratchPadUser } from "./useScratchpadUser";

export const useAgentCredentials = () => {
    const { mutate } = useSWRConfig();
    const {user} = useScratchPadUser();

    const { data, error, isLoading } = useSWR(
      SWR_KEYS.agentCredentials.list(),
      () => agentCredentialsApi.list()
    );
  
    const createCredentials = async (dto: CreateAiAgentCredentialDto) => {
      await agentCredentialsApi.create(dto);
      mutate(SWR_KEYS.agentCredentials.list());
    };
  
    const updateCredentials = async (id: string, dto: UpdateAiAgentCredentialDto) => {
      await agentCredentialsApi.update(id, dto);
      mutate(SWR_KEYS.agentCredentials.list());
      mutate(SWR_KEYS.agentCredentials.detail(id));
    };

    const deleteCredentials = async (id: string) => {
      await agentCredentialsApi.delete(id);
      mutate(SWR_KEYS.agentCredentials.list());
    };

    const activeOpenRouterCredentials = useMemo(() => {
      return data?.find((credential) => credential.enabled && credential.service === 'openrouter');
    }, [data]);
  
    const aiAgentEnabled = useMemo(() => {
        // if user agent credentials are required, and the user is not an admin, then the AI agent is enabled if the user has active open router credentials
        const requireUserAgentCredentials = process.env.NEXT_PUBLIC_USER_AGENT_CREDENTIALS_REQUIRED === 'true';
      if(requireUserAgentCredentials && !user?.isAdmin){
        return !!activeOpenRouterCredentials;
      }
      return true; 
    }, [activeOpenRouterCredentials, user]);

    return {
      agentCredentials: data,
      isLoading,
      error,
      createCredentials,
      updateCredentials,
      deleteCredentials,
      activeOpenRouterCredentials,
      aiAgentEnabled,
    };
  };