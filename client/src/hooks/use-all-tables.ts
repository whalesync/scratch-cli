import { connectorAccountsApi } from '@/lib/api/connector-accounts';
import { SWR_KEYS } from '@/lib/api/keys';
import { TableGroup } from '@/types/server-entities/table-list';
import useSWR from 'swr';

export function useAllTables() {
  const { data, error, isLoading, mutate } = useSWR<TableGroup[]>(
    SWR_KEYS.connectorAccounts.allTables(),
    () => connectorAccountsApi.listAllTables(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  return {
    tables: data || [],
    isLoading,
    error,
    mutate,
  };
}
