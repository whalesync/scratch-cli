import { useState, useCallback } from 'react';
import { snapshotApi } from '@/lib/api/snapshot';
import { PublishSummary } from '@/types/server-entities/publish-summary';

export const usePublishSummary = (snapshotId: string) => {
  const [publishSummary, setPublishSummary] = useState<PublishSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchSummary = useCallback(async () => {
    if (hasLoaded) return; // Only fetch once
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await snapshotApi.getPublishSummary(snapshotId);
      setPublishSummary(data);
      setHasLoaded(true);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [snapshotId, hasLoaded]);

  const refetch = useCallback(async () => {
    setHasLoaded(false); // Reset so it can be fetched again
    await fetchSummary();
  }, [fetchSummary]);

  return {
    publishSummary,
    isLoading,
    error,
    fetchSummary,
    refetch,
    hasLoaded,
  };
};
