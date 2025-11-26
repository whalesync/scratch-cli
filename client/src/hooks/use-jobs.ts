import useSWR from 'swr';
import { jobApi } from '../lib/api/job';
import { JobEntity } from '../types/server-entities/job';

export const useJobs = (limit?: number, offset?: number) => {
  const { data, error, isLoading, mutate } = useSWR<JobEntity[]>(
    `jobs-${limit}-${offset}`,
    () => jobApi.getJobs(limit, offset),
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
