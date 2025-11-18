'use client';

import { ButtonPrimarySolid } from '@/app/components/base/buttons';
import { PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useWorkbooks } from '../../../hooks/use-workbooks';
import { RouteUrls } from '../../../utils/route-urls';
import { ScratchpadNotifications } from '../../components/ScratchpadNotifications';

export const CreateWorkbookButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { createWorkbook } = useWorkbooks();
  const router = useRouter();

  const handleCreateWorkbook = useCallback(async () => {
    setIsLoading(true);
    try {
      const newWorkbook = await createWorkbook({});
      router.push(RouteUrls.workbookPageUrl(newWorkbook.id));
    } catch (error) {
      ScratchpadNotifications.error({
        title: 'Error creating workbook',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  }, [createWorkbook, router]);
  return (
    <ButtonPrimarySolid
      leftSection={<PlusIcon />}
      loading={isLoading}
      disabled={isLoading}
      onClick={handleCreateWorkbook}
    >
      New workbook
    </ButtonPrimarySolid>
  );
};
