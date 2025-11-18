import { workbookApi } from '@/lib/api/workbook';
import { PublishSummary } from '@/types/server-entities/publish-summary';
import { useCallback, useState } from 'react';
import { WorkbookId } from '../types/server-entities/ids';

export const usePublishSummary = (workbookId: WorkbookId | null) => {
  const [publishSummary, setPublishSummary] = useState<PublishSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // const [hasLoaded, setHasLoaded] = useState(false);

  const fetchSummary = useCallback(async () => {
    if (!workbookId) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await workbookApi.getPublishSummary(workbookId);
      setPublishSummary(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [workbookId]);

  return {
    publishSummary,
    isLoading,
    error,
    fetchSummary,
  };
};
