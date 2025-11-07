import { isUnauthorizedError } from '@/lib/api/error';
import { SWR_KEYS } from '@/lib/api/keys';
import { snapshotApi } from '@/lib/api/snapshot';
import { CreateSnapshotDto, Snapshot, UpdateSnapshotDto } from '@/types/server-entities/snapshot';
import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';

export interface UseSnapshotsReturn {
  snapshots: Snapshot[] | undefined;
  isLoading: boolean;
  error: Error | undefined;
  createSnapshot: (dto: CreateSnapshotDto) => Promise<Snapshot>;
  updateSnapshot: (id: string, updateDto: UpdateSnapshotDto) => Promise<Snapshot>;
  deleteSnapshot: (id: string) => Promise<void>;
  refreshSnapshots: () => Promise<void>;
}

export const useSnapshots = (connectorAccountId?: string): UseSnapshotsReturn => {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(SWR_KEYS.snapshot.list(), () => snapshotApi.list(connectorAccountId), {
    refreshInterval: 10000,
    revalidateOnReconnect: true,
  });

  const createSnapshot = useCallback(
    async (dto: CreateSnapshotDto): Promise<Snapshot> => {
      const newSnapshot = await snapshotApi.create(dto);
      mutate(SWR_KEYS.snapshot.list());
      return newSnapshot; // Return the new snapshot to the caller.
    },
    [mutate],
  );

  const updateSnapshot = useCallback(
    async (id: string, updateDto: UpdateSnapshotDto): Promise<Snapshot> => {
      const updatedSnapshot = await snapshotApi.update(id, updateDto);
      mutate(SWR_KEYS.snapshot.list());
      mutate(SWR_KEYS.snapshot.detail(id));
      return updatedSnapshot;
    },
    [mutate],
  );

  const deleteSnapshot = useCallback(
    async (id: string): Promise<void> => {
      await snapshotApi.delete(id);
      mutate(SWR_KEYS.snapshot.list());
    },
    [mutate],
  );

  const refreshSnapshots = useCallback(async () => {
    await mutate(SWR_KEYS.snapshot.list());
  }, [mutate]);

  const displayError = useMemo(() => {
    if (isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);

  return {
    snapshots: data,
    isLoading,
    error: displayError,
    createSnapshot,
    updateSnapshot,
    deleteSnapshot,
    refreshSnapshots,
  };
};
