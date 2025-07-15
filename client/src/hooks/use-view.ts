import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { viewApi } from '@/lib/api/view';
import { SWR_KEYS } from '@/lib/api/keys';
import { ViewConfig } from '@/types/server-entities/view';

export const useViews = (snapshotId: string) => {
  const { data, error, isLoading, mutate } = useSWR(
    SWR_KEYS.view.list(snapshotId),
    () => viewApi.getBySnapshot(snapshotId),
    {
      revalidateOnFocus: false,
      refreshInterval: 2000,
    }
  );

  return {
    views: data,
    isLoading,
    error,
    refreshViews: mutate,
  };
};

export const useUpsertView = () => {
  const { trigger, isMutating, error } = useSWRMutation(
    SWR_KEYS.view.upsert(),
    async (_key: string[], { arg }: { arg: {
      id?: string;
      parentId?: string;
      name?: string;
      snapshotId: string;
      config: ViewConfig;
      save?: boolean;
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