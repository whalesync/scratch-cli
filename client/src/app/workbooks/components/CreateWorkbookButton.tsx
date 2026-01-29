'use client';

import { ButtonPrimaryLight, ButtonPrimarySolid } from '@/app/components/base/buttons';
import { ButtonProps } from '@mantine/core';
import { PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useWorkbooks } from '../../../hooks/use-workbooks';
import { useScratchPadUser } from '../../../hooks/useScratchpadUser';
import { useWorkbookEditorUIStore } from '../../../stores/workbook-editor-store';
import { RouteUrls } from '../../../utils/route-urls';
import { ScratchpadNotifications } from '../../components/ScratchpadNotifications';

export const CreateWorkbookButton = ({
  size = 'sm',
  variant = 'solid',
}: {
  size?: ButtonProps['size'];
  variant?: 'solid' | 'light';
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { createWorkbook } = useWorkbooks();
  const router = useRouter();
  const user = useScratchPadUser();
  const workbookMode = useWorkbookEditorUIStore((state) => state.workbookMode);
  const workbookModeActiveFlag = user.user?.experimentalFlags?.DEFAULT_WORKBOOK_MODE;
  const handleCreateWorkbook = useCallback(async () => {
    setIsLoading(true);
    try {
      const newWorkbook = await createWorkbook({});

      if (workbookModeActiveFlag === 'files' || workbookMode === 'files') {
        router.push(RouteUrls.workbookFilePageUrl(newWorkbook.id));
      } else {
        router.push(RouteUrls.workbookScratchSyncPageUrl(newWorkbook.id));
      }
    } catch (error) {
      ScratchpadNotifications.error({
        title: 'Error creating workbook',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  }, [createWorkbook, router, workbookModeActiveFlag, workbookMode]);
  return variant === 'solid' ? (
    <ButtonPrimarySolid
      leftSection={<PlusIcon />}
      loading={isLoading}
      disabled={isLoading}
      onClick={handleCreateWorkbook}
      size={size}
    >
      New workbook
    </ButtonPrimarySolid>
  ) : (
    <ButtonPrimaryLight
      leftSection={<PlusIcon />}
      loading={isLoading}
      disabled={isLoading}
      onClick={handleCreateWorkbook}
      size={size}
    >
      New workbook
    </ButtonPrimaryLight>
  );
};
