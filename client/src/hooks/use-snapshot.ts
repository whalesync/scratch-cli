import useSWR, { useSWRConfig } from "swr";
import { snapshotApi } from "@/lib/api/snapshot";
import { SWR_KEYS } from "@/lib/api/keys";
import {
  CreateSnapshotDto,
  SnapshotRecord,
  SnapshotTableView,
} from "@/types/server-entities/snapshot";
import {
  BulkUpdateRecordsDto,
  ListRecordsResponse,
} from "../types/server-entities/records";
import { useCallback, useMemo } from "react";

export const useSnapshots = (connectorAccountId?: string) => {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(
    SWR_KEYS.snapshot.list(connectorAccountId ?? "all"),
    () => snapshotApi.list(connectorAccountId)
  );

  const createSnapshot = async (dto: CreateSnapshotDto) => {
    await snapshotApi.create(dto);
    mutate(SWR_KEYS.snapshot.list(connectorAccountId ?? "all"));
  };

  const updateSnapshot = async (id: string) => {
    await snapshotApi.update(id);
    mutate(SWR_KEYS.snapshot.list(connectorAccountId ?? "all"));
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
  const { data, error, isLoading, mutate } = useSWR(
    SWR_KEYS.snapshot.detail(id),
    () => snapshotApi.detail(id), 
    {
      revalidateOnFocus: false,
      refreshInterval: 5000,
    }
  );

  const { mutate: globalMutate } = useSWRConfig();

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

  return {
    snapshot: data,
    isLoading,
    error,
    publish,
  };
};

export const useSnapshotViews = (args: {
  snapshotId: string,
  tableId: string,
}) => {
  const { snapshotId, tableId } = args;
  const swrKey = SWR_KEYS.snapshot.views(snapshotId, tableId);

  const { data, error, isLoading } = useSWR(swrKey, () =>
    snapshotApi.listViews(snapshotId, tableId),
    {
      revalidateOnFocus: false,
      refreshInterval: 10000,
    }
  );

  return {
    views: data,
    isLoading,
    error,
  };
};

export const useSnapshotRecords = (args: {
  snapshotId: string,
  tableId: string,
  cursor?: string,
  take?: number,
  activeView?: SnapshotTableView
}) => {
  const { snapshotId, tableId, cursor, take, activeView } = args;
  const swrKey = SWR_KEYS.snapshot.records(snapshotId, tableId, cursor, take);

  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(swrKey, () =>
    snapshotApi.listRecords(snapshotId, tableId, cursor, take),
    {
      revalidateOnFocus: false,
      refreshInterval: 10000,
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


  const recordsResponse = useMemo(() => {
    if (!data) {
      return undefined;
    }

    if (activeView) {
      // mark records that are not in the active view as filtered
      return {
        ...data,
        records: data.records.map((r) => ({...r, filtered: !activeView.recordIds.includes(r.id.wsId)})),
      };
    }
    else{
      return {
        ...data,
        records: data.records.map((r) => ({...r, filtered: false})),
      };
    }
  }, [data, activeView]);

  return {
    recordsResponse,
    isLoading,
    error,
    bulkUpdateRecords,
    refreshRecords,
  };
};
