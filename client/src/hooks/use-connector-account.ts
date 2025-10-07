import { connectorAccountsApi } from "@/lib/api/connector-accounts";
import { isUnauthorizedError } from "@/lib/api/error";
import { SWR_KEYS } from "@/lib/api/keys";
import {
  ConnectorAccount,
  CreateConnectorAccountDto,
  TestConnectionResponse,
  UpdateConnectorAccountDto,
} from "@/types/server-entities/connector-accounts";
import { useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";

export const useConnectorAccounts = () => {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(
    SWR_KEYS.connectorAccounts.list(),
    connectorAccountsApi.list
  );

  const createConnectorAccount = async (
    dto: CreateConnectorAccountDto
  ): Promise<ConnectorAccount> => {
    const newAccount = await connectorAccountsApi.create(dto);
    mutate(SWR_KEYS.connectorAccounts.list());
    return newAccount;
  };

  const updateConnectorAccount = async (
    id: string,
    dto: UpdateConnectorAccountDto
  ) => {
    await connectorAccountsApi.update(id, dto);
    mutate(SWR_KEYS.connectorAccounts.list());
  };

  const deleteConnectorAccount = async (id: string) => {
    await connectorAccountsApi.delete(id);
    mutate(SWR_KEYS.connectorAccounts.list());
  };

  const testConnection = async (
    id: string
  ): Promise<TestConnectionResponse> => {
    const r = await connectorAccountsApi.test(id);
    mutate(SWR_KEYS.connectorAccounts.detail(id));
    mutate(SWR_KEYS.connectorAccounts.list());
    return r;
  };

  const displayError = useMemo(() => {
    if(isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);
  
  return {
    connectorAccounts: data,
    isLoading,
    error: displayError,
    createConnectorAccount,
    updateConnectorAccount,
    deleteConnectorAccount,
    testConnection,
  };
};

export const useConnectorAccount = (id?: string) => {
  const { data, error, isLoading } = useSWR(
    id ? SWR_KEYS.connectorAccounts.detail(id) : null,
    () => (id ? connectorAccountsApi.detail(id) : null)
  );

  return {
    connectorAccount: data,
    isLoading,
    error,
  };
};
