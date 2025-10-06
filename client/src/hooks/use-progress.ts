import { useState } from 'react';
import useSWR from 'swr';
import { progressApi } from '../lib/api/progress';
import { JobProgressEntity } from '@/types/server-entities/job';

export const useJobProgress = (jobId: string | null, continuePolling = false) => {
  const { data, error, isLoading, mutate } = useSWR<JobProgressEntity>(
    jobId ? `progress-${jobId}` : null,
    jobId ? () => progressApi.getJobProgress(jobId) : null,
    {
      refreshInterval: continuePolling ? 1000 : 0, // Poll every second if continuePolling is true
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    progress: data,
    error,
    isLoading,
    mutate,
  };
};

export const useJobProgressWithCancellation = (jobId: string | null) => {
  const [cancellationRequested, setCancellationRequested] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Always poll initially - we'll control stopping based on state
  const { progress, error, isLoading, mutate } = useJobProgress(jobId, true);

  const cancelJob = async () => {
    if (isCancelling || cancellationRequested || !jobId) return;
    
    setIsCancelling(true);
    try {
      const result = await progressApi.cancelJob(jobId);
      if (result.success) {
        setCancellationRequested(true);
        // Continue polling to see when the job actually stops
        mutate();
      }
    } catch (error) {
      console.error('Failed to cancel job:', error);
    } finally {
      setIsCancelling(false);
    }
  };

  return {
    progress,
    error,
    isLoading,
    mutate,
    cancellationRequested,
    isCancelling,
    cancelJob,
  };
};
