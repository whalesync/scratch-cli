import { connectorAccountsApi } from '@/lib/api/connector-accounts';
import { isUnauthorizedError } from '@/lib/api/error';
import { SWR_KEYS } from '@/lib/api/keys';
import {
  ConnectorAccount,
  CreateConnectorAccountDto,
  TestConnectionResponse,
  UpdateConnectorAccountDto,
} from '@/types/server-entities/connector-accounts';
import { useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ScratchpadNotifications } from '../app/components/ScratchpadNotifications';
import { serviceName } from '../service-naming-conventions';
import { useOnboardingUpdate } from './useOnboardingUpdate';

export const useConnectorAccounts = () => {
  const { mutate } = useSWRConfig();
  const {
    data,
    error,
    isLoading,
    mutate: mutateConnectorAccounts,
  } = useSWR(SWR_KEYS.connectorAccounts.list(), connectorAccountsApi.list);
  const { markStepCompleted } = useOnboardingUpdate();

  const createConnectorAccount = async (dto: CreateConnectorAccountDto): Promise<ConnectorAccount> => {
    const newAccount = await connectorAccountsApi.create(dto);
    mutate(SWR_KEYS.connectorAccounts.list());
    mutate(SWR_KEYS.connectorAccounts.allTables());
    // Mark data source connected step as completed
    markStepCompleted('gettingStartedV1', 'dataSourceConnected');
    return newAccount;
  };

  const updateConnectorAccount = async (id: string, dto: UpdateConnectorAccountDto) => {
    await connectorAccountsApi.update(id, dto);
    mutate(SWR_KEYS.connectorAccounts.list());
  };

  const deleteConnectorAccount = async (id: string) => {
    await connectorAccountsApi.delete(id);
    mutate(SWR_KEYS.connectorAccounts.list());
  };

  const testConnection = async (con: ConnectorAccount): Promise<TestConnectionResponse> => {
    try {
      const r = await connectorAccountsApi.test(con.id);
      mutate(SWR_KEYS.connectorAccounts.detail(con.id));
      mutate(SWR_KEYS.connectorAccounts.list());
      if (r.health == 'ok') {
        ScratchpadNotifications.success({
          title: 'Connection healthy',
          message: `Scratch can connect to ${serviceName(con.service)}`,
        });
      } else {
        ScratchpadNotifications.error({
          title: 'Connection error',
          message: r.error,
        });
      }
      return r;
    } catch (e) {
      ScratchpadNotifications.error({
        title: 'Connection error',
        message: e instanceof Error ? e.message : 'Unknown error',
      });
      return { health: 'error', error: e instanceof Error ? e.message : 'Unknown error' };
    }
  };

  const displayError = useMemo(() => {
    if (isUnauthorizedError(error)) {
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
    refreshConnectorAccounts: () => mutateConnectorAccounts(),
  };
};

export const useConnectorAccount = (id?: string) => {
  const { data, error, isLoading } = useSWR(id ? SWR_KEYS.connectorAccounts.detail(id) : null, () =>
    id ? connectorAccountsApi.detail(id) : null,
  );

  return {
    connectorAccount: data,
    isLoading,
    error,
  };
};
