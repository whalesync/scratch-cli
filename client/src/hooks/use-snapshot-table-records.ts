import { SWR_KEYS } from "@/lib/api/keys";
import { snapshotApi } from "@/lib/api/snapshot";
import {
  AcceptAllSuggestionsResult,
  RejectAllSuggestionsResult,
  SnapshotRecord
} from "@/types/server-entities/snapshot";
import { useCallback, useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  BulkUpdateRecordsDto,
  ListRecordsResponse,
} from "../types/server-entities/records";


export interface UseSnapshotRecordsReturn {
    records: SnapshotRecord[] | undefined;
    isLoading: boolean;
    error: Error | undefined;
    bulkUpdateRecords: (dto: BulkUpdateRecordsDto) => Promise<void>;
    refreshRecords: () => Promise<void>;
    acceptCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
    rejectCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
    count: number;
    filteredCount: number;
    recordsWithSuggestions: number;
    totalSuggestions: number;
    acceptAllSuggestions: () => Promise<AcceptAllSuggestionsResult>;
    rejectAllSuggestions: () => Promise<RejectAllSuggestionsResult>;
  }
  
  export const useSnapshotTableRecords = (args: {
    snapshotId: string,
    tableId: string,
    cursor?: string,
    take?: number,
    viewId?: string
  }): UseSnapshotRecordsReturn => {
    const { snapshotId, tableId, cursor, take = 1000, viewId = undefined } = args;
    const swrKey = SWR_KEYS.snapshot.records(snapshotId, tableId, cursor, take, viewId);
  
    const { mutate } = useSWRConfig();
    const { data, error, isLoading } = useSWR(swrKey, () =>
      snapshotApi.listRecords(snapshotId, tableId, cursor, take, viewId),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
      }
    );
  
    const refreshRecords = useCallback(async () => {
      await mutate(swrKey);
    }, [mutate, swrKey]);
    
    const bulkUpdateRecords = useCallback(
      async (dto: BulkUpdateRecordsDto) => {
        // Optimistic update.
        // We don't have to handle rollbacks, because the revalidate:true will pull the canonical state from the server.
        const optimisticData = (data: ListRecordsResponse | undefined) => {
          if (!data) {
            return undefined;
          }
  
          let newRecords = [...data.records];
  
          for (const op of dto.ops) {
            const recordIndex = newRecords.findIndex(
              (r) => r.id.wsId === op.wsId
            );
  
            if (op.op === "update") {
              if (recordIndex === -1) {
                continue;
              }
  
              // Clone the record to avoid mutating the original cache
              const record = { ...newRecords[recordIndex] };
  
              // Update the data fields
              if (op.data) {
                Object.assign(record.fields, op.data);
              }
  
              // Update the edited fields metadata
              const newEditedFields = { ...(record.__edited_fields || {}) };
              if (op.data) {
                for (const key of Object.keys(op.data)) {
                  newEditedFields[key] = "NOW";
                }
              }
              record.__edited_fields = newEditedFields;
              newRecords[recordIndex] = record;
            } else if (op.op === "delete") {
              if (recordIndex === -1) {
                continue;
              }
              const record = { ...newRecords[recordIndex] };
              record.__edited_fields = { __deleted: "NOW" };
              newRecords[recordIndex] = record;
            } else if (op.op === "create") {
              if (recordIndex !== -1) {
                // Already exists, this is an error condition but we'll ignore it for optimistic updates.
                continue;
              }
              const newRecord: SnapshotRecord = {
                id: {
                  wsId: op.wsId,
                  remoteId: null,
                },
                fields: op.data ?? {},
                __edited_fields: { __created: "NOW" },
                __dirty: true,
              };
              newRecords = [newRecord, ...newRecords];
            }
          }
  
          const newData: ListRecordsResponse = {
            ...data,
            records: newRecords,
          };
          return newData;
        };
  
        try {
          await mutate(swrKey, optimisticData(data), { revalidate: false });
          await snapshotApi.bulkUpdateRecords(snapshotId, tableId, dto);
        } catch (e) {
          // Re-throw the error so the calling component can handle it.
          throw e;
        } finally {
          // Always revalidate to get the canonical state from the server.
          await mutate(swrKey);
        }
      },
      [snapshotId, tableId, mutate, swrKey, data]
    );
  
    const acceptCellValues = useCallback(
      async (items: { wsId: string; columnId: string }[]) => {
        try {
          await snapshotApi.acceptCellValues(snapshotId, tableId, items);
        } catch (e) {
          // Re-throw the error so the calling component can handle it.
          throw e;
        } finally {
          // Always revalidate to get the canonical state from the server.
          await mutate(swrKey);
        }
      },
      [snapshotId, tableId, mutate, swrKey]
    );
  
    const rejectCellValues = useCallback(
      async (items: { wsId: string; columnId: string }[]) => {
        try {
          await snapshotApi.rejectCellValues(snapshotId, tableId, items);
        } catch (e) {
          // Re-throw the error so the calling component can handle it.
          throw e;
        } finally {
          // Always revalidate to get the canonical state from the server.
          await mutate(swrKey);
        }
      },
      [snapshotId, tableId, mutate, swrKey]
    );
  
    const { recordsWithSuggestions, totalSuggestions } = useMemo(() => {
      let recordsWithSuggestions = 0;
      let totalSuggestions = 0;
      if(data?.records) {
        for(const record of data.records) {
            const columnsWithSuggestions = Object.keys(record.__suggested_values ?? {}).filter((key) => !key.startsWith('__') && key !== 'id');
          if(columnsWithSuggestions.length > 0) {
            recordsWithSuggestions++;
            totalSuggestions += columnsWithSuggestions.length;
          }
        }
      }
  
      return {
        recordsWithSuggestions,
        totalSuggestions,
      };
      
    }, [data]);
  
  
    const acceptAllSuggestions = useCallback(async () => {
      if (!tableId || !snapshotId) return { recordsUpdated: 0, totalChangesAccepted: 0 };
      const result = await snapshotApi.acceptAllSuggestions(snapshotId, tableId, viewId);
      return result;
    }, [tableId, snapshotId, viewId]);
  
  
    const rejectAllSuggestions = useCallback(async () => {
      if (!tableId || !snapshotId) return { recordsRejected: 0, totalChangesRejected: 0 };
      const result = await snapshotApi.rejectAllSuggestions(snapshotId, tableId, viewId);
      return result;
    }, [tableId, snapshotId, viewId]);
  
  
    return {
      records: data?.records ?? undefined,
      isLoading,
      error,
      bulkUpdateRecords,
      refreshRecords,
      acceptCellValues,
      rejectCellValues,
      count: data?.count || 0,
      filteredCount: data?.filteredCount || 0,
      recordsWithSuggestions,
      totalSuggestions,
      acceptAllSuggestions,
      rejectAllSuggestions,
    };
  };
  