import useSWR from "swr";
import { connectionsApi } from "@/lib/api/connections";
import { SWR_KEYS } from "@/lib/api/keys";
import {
  CreateConnectionDto,
  UpdateConnectionDto,
} from "@/types/server-entities/connections";
import { useSWRConfig } from "swr";

export const useConnections = () => {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(
    SWR_KEYS.connections.list(),
    connectionsApi.list
  );

  const createConnection = async (dto: CreateConnectionDto) => {
    await connectionsApi.create(dto);
    mutate(SWR_KEYS.connections.list());
  };

  const updateConnection = async (id: string, dto: UpdateConnectionDto) => {
    await connectionsApi.update(id, dto);
    mutate(SWR_KEYS.connections.list());
  };

  const deleteConnection = async (id: string) => {
    await connectionsApi.delete(id);
    mutate(SWR_KEYS.connections.list());
  };

  return {
    connections: data,
    isLoading,
    error,
    createConnection,
    updateConnection,
    deleteConnection,
  };
};
