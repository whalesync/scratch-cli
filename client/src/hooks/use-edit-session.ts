import useSWR from "swr";
import { useSWRConfig } from "swr";
import { editSessionsApi } from "@/lib/api/edit-session";
import { SWR_KEYS } from "@/lib/api/keys";
import {
  CreateEditSessionDto,
  UpdateEditSessionDto,
} from "@/types/server-entities/edit-session";

export const useEditSessions = (connectorAccountId: string) => {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(
    SWR_KEYS.editSessions.list(connectorAccountId),
    () => editSessionsApi.list(connectorAccountId)
  );

  const createEditSession = async (dto: CreateEditSessionDto) => {
    await editSessionsApi.create(dto);
    mutate(SWR_KEYS.editSessions.list(connectorAccountId));
  };

  const updateEditSession = async (id: string, dto: UpdateEditSessionDto) => {
    await editSessionsApi.update(id, dto);
    mutate(SWR_KEYS.editSessions.list(connectorAccountId));
    mutate(SWR_KEYS.editSessions.detail(id));
  };

  return {
    editSessions: data,
    isLoading,
    error,
    createEditSession,
    updateEditSession,
  };
};

export const useEditSession = (id: string) => {
  const { data, error, isLoading } = useSWR(
    SWR_KEYS.editSessions.detail(id),
    () => editSessionsApi.detail(id)
  );

  return {
    editSession: data,
    isLoading,
    error,
  };
};
