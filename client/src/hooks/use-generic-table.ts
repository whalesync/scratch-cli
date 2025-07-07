import useSWR from "swr";
import { genericTableApi } from "@/lib/api/generic-table";
import { SWR_KEYS } from "@/lib/api/keys";
import { CreateGenericTableDto, GenericTable } from "@/types/server-entities/generic-table";
import { useSWRConfig } from "swr";

export const useGenericTables = () => {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(
    SWR_KEYS.genericTables.list(),
    () => genericTableApi.list()
  );

  const createGenericTable = async (
    dto: CreateGenericTableDto
  ): Promise<GenericTable> => {
    const newTable = await genericTableApi.create(dto);
    mutate(SWR_KEYS.genericTables.list());
    return newTable;
  };

  const updateGenericTable = async (
    tableId: string,
    dto: CreateGenericTableDto
  ): Promise<GenericTable> => {
    const updatedTable = await genericTableApi.update(tableId, dto);
    mutate(SWR_KEYS.genericTables.list());
    mutate(SWR_KEYS.genericTables.detail(tableId));
    return updatedTable;
  };

  const deleteGenericTable = async (tableId: string): Promise<void> => {
    await genericTableApi.delete(tableId);
    mutate(SWR_KEYS.genericTables.list());
  };

  return {
    data,
    error,
    isLoading,
    createGenericTable,
    updateGenericTable,
    deleteGenericTable,
  };
};

export const useGenericTable = (id: string) => {
  const { data, error, isLoading } = useSWR(
    id ? SWR_KEYS.genericTables.detail(id) : null,
    () => (id ? genericTableApi.detail(id) : null)
  );

  return {
    data,
    error,
    isLoading,
  };
}; 