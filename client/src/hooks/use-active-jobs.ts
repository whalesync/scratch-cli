import { DataFolderId } from '@spinner/shared-types';
import { useCallback } from 'react';
import useSWR from 'swr';
import { jobApi } from '../lib/api/job';
import { SWR_KEYS } from '../lib/api/keys';
import { JobEntity } from '../types/server-entities/job';

export const useActiveJobs = (dataFolderId: DataFolderId | undefined, autoRefresh: boolean = false) => {
  const { data, error, isLoading, mutate } = useSWR<JobEntity[]>(
    dataFolderId ? SWR_KEYS.jobs.activeByDataFolder(dataFolderId) : null,
    () => jobApi.getActiveJobsByDataFolder(dataFolderId!),
    {
      refreshInterval: autoRefresh ? 2000 : undefined,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const refreshJobs = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const activeJobs = data || [];

  return {
    activeJobs,
    error,
    isLoading,
    refreshJobs,
  };
};
