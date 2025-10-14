import { SWR_KEYS } from '@/lib/api/keys';
import { ListUploadsResponse, uploadsApi } from '@/lib/api/uploads';
import useSWR from 'swr';

export function useUploads() {
  const { data, error, isLoading, mutate } = useSWR<ListUploadsResponse>(
    SWR_KEYS.uploads.list(),
    () => uploadsApi.listUploads(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  return {
    uploads: data?.uploads || [],
    isLoading,
    error,
    mutate,
  };
}

