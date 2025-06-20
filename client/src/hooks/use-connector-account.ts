import useSWR from "swr";
import { connectorAccountsApi } from "@/lib/api/connector-accounts";
import { SWR_KEYS } from "@/lib/api/keys";
import {
  CreateConnectorAccountDto,
  TestConnectionResponse,
  UpdateConnectorAccountDto,
} from "@/types/server-entities/connector-accounts";
import { useSWRConfig } from "swr";

export const useConnectorAccounts = () => {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(
    SWR_KEYS.connectorAccounts.list(),
    connectorAccountsApi.list
  );

  const createConnectorAccount = async (dto: CreateConnectorAccountDto) => {
    await connectorAccountsApi.create(dto);
    mutate(SWR_KEYS.connectorAccounts.list());
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
    return await connectorAccountsApi.test(id);
  };

  return {
    connectorAccounts: data,
    isLoading,
    error,
    createConnectorAccount,
    updateConnectorAccount,
    deleteConnectorAccount,
    testConnection,
  };
};
