import useSWR from 'swr';
import { snapshotApi } from '@/lib/api/snapshot';
import { SWR_KEYS } from '@/lib/api/keys';
import { PublishSummary } from '@/types/server-entities/publish-summary';

export const usePublishSummary = (snapshotId: string, enabled = false) => {
  const { data, error, isLoading, mutate } = useSWR(
    enabled ? SWR_KEYS.snapshot.publishSummary(snapshotId) : null,
    () => snapshotApi.getPublishSummary(snapshotId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    publishSummary: data as PublishSummary | undefined,
    isLoading,
    error,
    refetch: mutate,
  };
};
