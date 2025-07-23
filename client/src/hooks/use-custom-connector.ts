import useSWR from "swr";
import { customConnectorApi } from "@/lib/api/custom-connector";
import { SWR_KEYS } from "@/lib/api/keys";
import { CreateCustomConnectorDto, CustomConnector } from "@/types/server-entities/custom-connector";
import { useSWRConfig } from "swr";

export const useCustomConnectors = () => {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(
    SWR_KEYS.customConnectors.list(),
    () => customConnectorApi.list()
  );

  const createCustomConnector = async (
    dto: CreateCustomConnectorDto
  ): Promise<CustomConnector> => {
    const newConnector = await customConnectorApi.create(dto);
    mutate(SWR_KEYS.customConnectors.list());
    return newConnector;
  };

  const updateCustomConnector = async (
    connectorId: string,
    dto: CreateCustomConnectorDto
  ): Promise<CustomConnector> => {
    const updatedConnector = await customConnectorApi.update(connectorId, dto);
    mutate(SWR_KEYS.customConnectors.list());
    mutate(SWR_KEYS.customConnectors.detail(connectorId));
    return updatedConnector;
  };

  const deleteCustomConnector = async (connectorId: string): Promise<void> => {
    await customConnectorApi.delete(connectorId);
    mutate(SWR_KEYS.customConnectors.list());
  };

  return {
    data,
    error,
    isLoading,
    createCustomConnector,
    updateCustomConnector,
    deleteCustomConnector,
  };
};

export const useCustomConnector = (id: string) => {
  const { data, error, isLoading } = useSWR(
    id ? SWR_KEYS.customConnectors.detail(id) : null,
    () => (id ? customConnectorApi.detail(id) : null)
  );

  return {
    data,
    error,
    isLoading,
  };
}; 