import { agentCredentialsApi } from '@/lib/api/agent-credentials';
import { isUnauthorizedError } from '@/lib/api/error';
import { SWR_KEYS } from '@/lib/api/keys';
import { CreateAiAgentCredentialDto, UpdateAiAgentCredentialDto } from '@/types/server-entities/agent-credentials';
import { useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';

export const useAgentCredentials = (includeUsageStats: boolean = false) => {
  const { mutate } = useSWRConfig();

  const {
    data,
    error,
    isLoading,
    mutate: mutateList,
  } = useSWR(SWR_KEYS.agentCredentials.list(includeUsageStats), () => agentCredentialsApi.list(includeUsageStats));

  const createCredentials = async (dto: CreateAiAgentCredentialDto) => {
    await agentCredentialsApi.create(dto);
    mutateList();
  };

  const updateCredentials = async (id: string, dto: UpdateAiAgentCredentialDto) => {
    await agentCredentialsApi.update(id, dto);
    mutateList();
    mutate(SWR_KEYS.agentCredentials.detail(id));
  };

  const deleteCredentials = async (id: string) => {
    await agentCredentialsApi.delete(id);
    mutateList();
  };

  const toggleDefaultCredential = async (id: string) => {
    await agentCredentialsApi.setDefaultKey(id);
    mutateList();
    mutate(SWR_KEYS.agentCredentials.detail(id));
  };

  const activeOpenRouterCredentials = useMemo(() => {
    // try to find the default credential
    return data?.find((credential) => credential.default && credential.service === 'openrouter');
  }, [data]);

  const displayError = useMemo(() => {
    if (isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  return {
    agentCredentials: data,
    isLoading,
    error: displayError,
    createCredentials,
    updateCredentials,
    deleteCredentials,
    aiAgentEnabled: !!activeOpenRouterCredentials,
    toggleDefaultCredential,
    activeOpenRouterCredentials,
  };
};
