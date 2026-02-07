import { connectorAccountsApi } from '@/lib/api/connector-accounts';
import { SWR_KEYS } from '@/lib/api/keys';
import { TableGroup } from '@/types/server-entities/table-list';
import useSWR from 'swr';

export function useAllTables(workbookId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<TableGroup[]>(
    workbookId ? SWR_KEYS.connectorAccounts.allTables(workbookId) : null,
    () => (workbookId ? connectorAccountsApi.listAllTables(workbookId) : []),
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
