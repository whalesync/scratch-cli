import { isUnauthorizedError } from '@/lib/api/error';
import { styleGuideApi } from '@/lib/api/style-guide';
import { StyleGuide } from '@/types/server-entities/style-guide';
import { useMemo } from 'react';
import useSWR from 'swr';

export function useStyleGuides() {
  const { data, error, isLoading, mutate } = useSWR<StyleGuide[]>(
    'style-guides',
    () => styleGuideApi.getAll(),
    {
      revalidateOnFocus: false,
    }
  );

  const displayError = useMemo(() => {
    if(isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  return {
    styleGuides: data || [],
    isLoading,
    error: displayError,
    mutate,
  };
}

export function useStyleGuide(id: string) {
  const { data, error, isLoading, mutate } = useSWR<StyleGuide>(
    id ? `style-guide-${id}` : null,
    () => styleGuideApi.getById(id),
    {
      revalidateOnFocus: false,
    }
  );

  const displayError = useMemo(() => {
    if(isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  return {
    styleGuide: data,
    isLoading,
    error: displayError,
    mutate,
  };
} 