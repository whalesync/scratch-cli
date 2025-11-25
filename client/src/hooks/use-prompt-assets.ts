import { isUnauthorizedError } from '@/lib/api/error';
import { SWR_KEYS } from '@/lib/api/keys';
import { styleGuideApi } from '@/lib/api/style-guide';
import { StyleGuide } from '@/types/server-entities/style-guide';
import { StyleGuideId } from '@spinner/shared-types';
import { useMemo } from 'react';
import useSWR from 'swr';

export function usePromptAssets() {
  const { data, error, isLoading, mutate } = useSWR<StyleGuide[]>(
    SWR_KEYS.styleGuides.list(),
    () => styleGuideApi.getAll(),
    {},
  );

  const displayError = useMemo(() => {
    if (isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  const deleteAsset = async (id: StyleGuideId) => {
    try {
      await styleGuideApi.delete(id);
      await mutate();
    } catch (error) {
      console.log('Error deleting asset:', error);
    }
  };

  return {
    promptAssets: data || [],
    isLoading,
    error: displayError,
    mutate,
    deleteAsset,
  };
}

export function usePromptAsset(id: StyleGuideId) {
  const { data, error, isLoading, mutate } = useSWR<StyleGuide>(
    SWR_KEYS.styleGuides.detail(id),
    () => styleGuideApi.getById(id),
    {},
  );

  const displayError = useMemo(() => {
    if (isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  return {
    promptAsset: data,
    isLoading,
    error: displayError,
    mutate,
  };
}
