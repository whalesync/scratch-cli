import { isUnauthorizedError } from '@/lib/api/error';
import { filesApi } from '@/lib/api/files';
import { SWR_KEYS } from '@/lib/api/keys';
import { FileDetailsResponseDto, UpdateFileDto, WorkbookId } from '@spinner/shared-types';
import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';

export interface UseFileReturn {
  file: FileDetailsResponseDto | undefined;
  isLoading: boolean;
  error: Error | undefined;
  updateFile: (dto: UpdateFileDto) => Promise<void>;
  deleteFile: () => Promise<void>;
  refreshFile: () => Promise<void>;
}

/**
 * Hook for managing individual file operations
 * @param workbookId - The workbook ID to scope the file operations to
 * @param filePath - The path to the file within the workbook
 */
export const useFile = (workbookId: WorkbookId | null, filePath: string | null): UseFileReturn => {
  const { mutate: globalMutate } = useSWRConfig();

  const { data, error, isLoading, mutate } = useSWR(
    workbookId && filePath ? SWR_KEYS.files.detail(workbookId, filePath) : null,
    () => (workbookId && filePath ? filesApi.getFile(workbookId, filePath) : undefined),
    {
      revalidateOnFocus: false,
    },
  );

  const refreshFile = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const updateFile = useCallback(
    async (dto: UpdateFileDto): Promise<void> => {
      if (!workbookId || !filePath) {
        throw new Error('Workbook ID and file path are required');
      }

      await filesApi.updateFile(workbookId, filePath, dto);

      // Revalidate this file
      await mutate();

      // Revalidate all file lists for this workbook to update the tree
      globalMutate(SWR_KEYS.files.listKeyMatcher(workbookId), undefined, { revalidate: true });
    },
    [workbookId, filePath, mutate, globalMutate],
  );

  const deleteFile = useCallback(async (): Promise<void> => {
    if (!workbookId || !filePath) {
      throw new Error('Workbook ID and file path are required');
    }

    await filesApi.deleteFile(workbookId, filePath);

    // Clear this file from cache
    globalMutate(SWR_KEYS.files.detail(workbookId, filePath), undefined, { revalidate: false });

    // Revalidate all file lists for this workbook to update the tree
    globalMutate(SWR_KEYS.files.listKeyMatcher(workbookId), undefined, { revalidate: true });
  }, [workbookId, filePath, globalMutate]);

  const displayError = useMemo(() => {
    if (isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  return {
    file: data,
    isLoading,
    error: displayError,
    updateFile,
    deleteFile,
    refreshFile,
  };
};
