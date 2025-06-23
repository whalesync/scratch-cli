import useSWR from "swr";
import { useSWRConfig } from "swr";
import { snapshotApi } from "@/lib/api/snapshot";
import { SWR_KEYS } from "@/lib/api/keys";
import { CreateSnapshotDto } from "@/types/server-entities/snapshot";

export const useSnapshots = (connectorAccountId: string) => {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(
    SWR_KEYS.snapshot.list(connectorAccountId),
    () => snapshotApi.list(connectorAccountId)
  );

  const createSnapshot = async (dto: CreateSnapshotDto) => {
    await snapshotApi.create(dto);
    mutate(SWR_KEYS.snapshot.list(connectorAccountId));
  };

  const updateSnapshot = async (id: string) => {
    await snapshotApi.update(id);
    mutate(SWR_KEYS.snapshot.list(connectorAccountId));
    mutate(SWR_KEYS.snapshot.detail(id));
  };

  return {
    snapshots: data,
    isLoading,
    error,
    createSnapshot,
    updateSnapshot,
  };
};

export const useSnapshot = (id: string) => {
  const { data, error, isLoading } = useSWR(SWR_KEYS.snapshot.detail(id), () =>
    snapshotApi.detail(id)
  );

  return {
    snapshot: data,
    isLoading,
    error,
  };
};
