import { isUnauthorizedError } from "@/lib/api/error";
import { SWR_KEYS } from "@/lib/api/keys";
import { snapshotApi } from "@/lib/api/snapshot";
import {
  CreateSnapshotDto,
  Snapshot,
  UpdateSnapshotDto
} from "@/types/server-entities/snapshot";
import { useCallback, useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";

export const useSnapshots = (connectorAccountId?: string) => {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(
    SWR_KEYS.snapshot.list(connectorAccountId ?? "all"),
    () => snapshotApi.list(connectorAccountId),
    {refreshInterval: 10000,
      revalidateOnReconnect: true,
    }
  );

  const createSnapshot = async (dto: CreateSnapshotDto): Promise<Snapshot> => {
    const newSnapshot = await snapshotApi.create(dto);
    mutate(SWR_KEYS.snapshot.list(connectorAccountId ?? "all"));
    return newSnapshot; // Return the new snapshot to the caller.
  };

  const updateSnapshot = async (id: string, updateDto: UpdateSnapshotDto): Promise<Snapshot> => {
    const updatedSnapshot = await snapshotApi.update(id, updateDto);
    mutate(SWR_KEYS.snapshot.list(connectorAccountId ?? "all"));
    mutate(SWR_KEYS.snapshot.detail(id));
    return updatedSnapshot;
  };

  const deleteSnapshot = async (id: string): Promise<void> => {
    await snapshotApi.delete(id);
    mutate(SWR_KEYS.snapshot.list(connectorAccountId ?? "all"));
  };

  const refreshSnapshots = async () => {
    await mutate(SWR_KEYS.snapshot.list(connectorAccountId ?? "all"));
  }
  const displayError = useMemo(() => {
    if(isUnauthorizedError(error)) {
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

export interface UseSnapshotReturn {
  snapshot: Snapshot | undefined;
  isLoading: boolean;
  error: Error | undefined;
  publish: () => Promise<void>;
  refreshSnapshot: () => Promise<void>;
}

export const useSnapshot = (id: string): UseSnapshotReturn => {
  const { data, error, isLoading, mutate } = useSWR(
    SWR_KEYS.snapshot.detail(id),
    () => snapshotApi.detail(id), 
    {
      revalidateOnFocus: false,
    }
  );

  const { mutate: globalMutate } = useSWRConfig();

  const refreshSnapshot = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const publish = useCallback(async () => {
    if (!data) {
      return;
    }

    await snapshotApi.publish(id);
    // Revalidate the snapshot itself
    await mutate();

    // Revalidate the records in all tables for this snapshot.
    globalMutate(
      (key) =>
        Array.isArray(key) &&
        key[0] === "snapshot" &&
        key[1] === "records" &&
        key[2] === id,
      undefined,
      { revalidate: true }
    );
  }, [id, data, mutate, globalMutate]);

  const displayError = useMemo(() => {
    if(isUnauthorizedError(error)) {
      // ignore this error as it will be fixed after the token is refreshed
      return undefined;
    }
    return error?.message;
  }, [error]);


  return {
    snapshot: data,
    isLoading,
    error: displayError,
    publish,
    refreshSnapshot,
  };
};
