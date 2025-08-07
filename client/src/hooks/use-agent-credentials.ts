import { agentCredentialsApi } from "@/lib/api/agent-credentials";
import { SWR_KEYS } from "@/lib/api/keys";
import { CreateAiAgentCredentialDto, UpdateAiAgentCredentialDto } from "@/types/server-entities/agent-credentials";
import useSWR, { useSWRConfig } from "swr";

export const useAgentCredentials = () => {
    const { mutate } = useSWRConfig();

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
  
    return {
      agentCredentials: data,
      isLoading,
      error,
      createCredentials,
      updateCredentials,
      deleteCredentials,
    };
  };