import { SWR_KEYS } from '@/lib/api/keys';
import { viewApi } from '@/lib/api/view';
import { ViewConfig } from '@/types/server-entities/view';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';


export const useViews = (snapshotId: string, refreshIntervalMS: number = 30000) => {
  const { data, error, isLoading, mutate } = useSWR(
    SWR_KEYS.view.list(snapshotId),
    () => viewApi.getBySnapshot(snapshotId),
    {
      revalidateOnFocus: false,
      refreshInterval: refreshIntervalMS,
    }
  );

  return {
    views: data,
    isLoading,
    error,
    refreshViews: async () => {
      return await mutate();
    },
  };
};

export const useUpsertView = () => {
  const { trigger, isMutating, error } = useSWRMutation(
    SWR_KEYS.view.upsert(),
    async (_key: string[], { arg }: { arg: {
      id?: string;
      name?: string;
      snapshotId: string;
      config: ViewConfig;
    } }) => {
      return viewApi.upsert(arg);
    },
  );

  return {
    upsertView: trigger,
    isUpserting: isMutating,
    error,
  };
}; 