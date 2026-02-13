import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { isUnauthorizedError } from '@/lib/api/error';
import { SWR_KEYS } from '@/lib/api/keys';
import { workbookApi } from '@/lib/api/workbook';
import { trackDiscardChanges, trackPublishAll, trackPullFiles } from '@/lib/posthog';
import {
  CreateDataFolderDto,
  DataFolder,
  DataFolderId,
  UpdateWorkbookDto,
  Workbook,
  WorkbookId,
} from '@spinner/shared-types';
import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { dataFolderApi } from '../lib/api/data-folder';

export interface UseWorkbookReturn {
  workbook: Workbook | undefined;
  isLoading: boolean;
  error: Error | undefined;
  refreshWorkbook: () => Promise<void>;
  updateWorkbook: (updateDto: UpdateWorkbookDto) => Promise<void>;
  addLinkedDataFolder: (tableId: string[], folderName: string, connectorAccountId: string) => Promise<DataFolder>;
  pullFolders: (dataFolderIds?: DataFolderId[]) => Promise<void>;
  publishFolders: (dataFolderIds: DataFolderId[]) => Promise<void>;
  discardAllChanges: () => Promise<void>;
}

export const useWorkbook = (id: WorkbookId | null): UseWorkbookReturn => {
  const { data, error, isLoading, mutate } = useSWR(
    id ? SWR_KEYS.workbook.detail(id) : null,
    () => (id ? workbookApi.detail(id) : undefined),
    {
      revalidateOnFocus: false,
    },
  );

  const { mutate: globalMutate } = useSWRConfig();

  const refreshWorkbook = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const displayError = useMemo(() => {
    if (isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  const updateWorkbook = useCallback(
    async (updateDto: UpdateWorkbookDto): Promise<void> => {
      if (!id) {
        return;
      }
      await workbookApi.update(id, updateDto);
      globalMutate(SWR_KEYS.workbook.list());
      globalMutate(SWR_KEYS.workbook.detail(id));
    },
    [globalMutate, id],
  );

  const addLinkedDataFolder = useCallback(
    async (tableId: string[], folderName: string, connectorAccountId: string): Promise<DataFolder> => {
      if (!id) {
        throw new Error('Workbook not found');
      }

      const dto: CreateDataFolderDto = { tableId, workbookId: id, name: folderName, connectorAccountId };
      const dataFolder = await dataFolderApi.create(dto);
      await mutate();
      return dataFolder;
    },
    [id, mutate],
  );

  const publishFolders = useCallback(
    async (dataFolderIds: DataFolderId[]): Promise<void> => {
      if (!id || dataFolderIds.length === 0) {
        return;
      }
      trackPublishAll(id, dataFolderIds.length);
      try {
        await dataFolderApi.publish(dataFolderIds, id);
        ScratchpadNotifications.info({ message: 'Initiated data publish job for changes' });
      } catch (error) {
        //TODO: report this error to the user somehow
        console.debug('Failed to publish changes:', error);
      }
      await mutate();
      await globalMutate(SWR_KEYS.jobs.activeByWorkbook(id));
      await globalMutate(SWR_KEYS.dataFolders.list(id));
      for (const folderId of dataFolderIds) {
        globalMutate(SWR_KEYS.dataFolders.detail(folderId));
      }
    },
    [globalMutate, id, mutate],
  );

  const discardAllChanges = useCallback(async (): Promise<void> => {
    if (!id) {
      return;
    }
    trackDiscardChanges(id);
    try {
      await workbookApi.discardChanges(id);
      ScratchpadNotifications.info({ message: 'All unpublished changes have been discarded' });
    } catch (error) {
      console.debug('Failed to discard changes:', error);
    }
    await mutate();
    await globalMutate(SWR_KEYS.dataFolders.list(id));
    data?.dataFolders?.forEach((folder) => {
      globalMutate(SWR_KEYS.dataFolders.detail(folder.id));
    });
  }, [globalMutate, id, mutate, data]);

  const pullFolders = useCallback(
    async (folderIds?: DataFolderId[]): Promise<void> => {
      if (!id || !data) {
        return;
      }
      trackPullFiles(id);
      try {
        await workbookApi.pullFiles(id, folderIds);
        ScratchpadNotifications.info({ message: 'Initiated data pull for all tables in this workbook' });
      } catch (error) {
        //TODO: report this error to the user somehow
        console.debug('Failed to pull files:', error);
      }
      await mutate();
      await globalMutate(SWR_KEYS.jobs.activeByWorkbook(id));
      await globalMutate(SWR_KEYS.dataFolders.list(id));
      data.dataFolders?.forEach((folder) => {
        globalMutate(SWR_KEYS.dataFolders.detail(folder.id));
      });
    },
    [globalMutate, id, mutate, data],
  );

  return {
    workbook: data,
    isLoading,
    error: displayError,
    // publish,
    refreshWorkbook,
    updateWorkbook,
    addLinkedDataFolder,
    pullFolders,
    publishFolders,
    discardAllChanges,
  };
};
