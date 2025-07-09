import useSWR from 'swr';
import { styleGuideApi } from '@/lib/api/style-guide';
import { StyleGuide } from '@/types/server-entities/style-guide';

export function useStyleGuides() {
  const { data, error, isLoading, mutate } = useSWR<StyleGuide[]>(
    'style-guides',
    () => styleGuideApi.getAll(),
    {
      revalidateOnFocus: false,
    }
  );

  return {
    styleGuides: data || [],
    isLoading,
    error,
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

  return {
    styleGuide: data,
    isLoading,
    error,
    mutate,
  };
} 