'use client';

import { ButtonPrimarySolid } from '@/app/components/base/buttons';
import { PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useSnapshots } from '../../../hooks/use-snapshots';
import { RouteUrls } from '../../../utils/route-urls';
import { ScratchpadNotifications } from '../../components/ScratchpadNotifications';

export const CreateSnapshotButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { createSnapshot } = useSnapshots();
  const router = useRouter();

  const handleCreateSnapshot = useCallback(async () => {
    setIsLoading(true);
    try {
      const newSnapshot = await createSnapshot({});
      router.push(RouteUrls.snapshotPage(newSnapshot.id));
    } catch (error) {
      ScratchpadNotifications.error({
        title: 'Error creating workbook',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  }, [createSnapshot, router]);
  return (
    <ButtonPrimarySolid
      leftSection={<PlusIcon />}
      loading={isLoading}
      disabled={isLoading}
      onClick={handleCreateSnapshot}
    >
      New workbook
    </ButtonPrimarySolid>
  );
};
