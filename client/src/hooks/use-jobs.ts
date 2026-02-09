import useSWR from 'swr';
import { jobApi } from '../lib/api/job';
import { JobEntity } from '../types/server-entities/job';

export const useJobs = (limit?: number, offset?: number, workbookId?: string) => {
  const { data, error, isLoading, mutate } = useSWR<JobEntity[]>(
    workbookId ? `jobs-${limit}-${offset}-${workbookId}` : null,
    () => jobApi.getJobs(limit, offset, workbookId),
    {
      refreshInterval: 5000, // Poll every 5 seconds
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  return {
    jobs: data || [],
    error,
    isLoading,
    mutate,
  };
};
