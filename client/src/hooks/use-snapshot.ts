import useSWR, { useSWRConfig } from "swr";
import { snapshotApi } from "@/lib/api/snapshot";
import { SWR_KEYS } from "@/lib/api/keys";
import {
  CreateSnapshotDto,
  SnapshotRecord,
} from "@/types/server-entities/snapshot";
import {
  BulkUpdateRecordsDto,
  ListRecordsResponse,
} from "../types/server-entities/records";
import { useCallback } from "react";

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

export const useSnapshotRecords = (
  snapshotId: string,
  tableId: string,
  cursor?: string,
  take: number = 5000
) => {
  const swrKey = SWR_KEYS.snapshot.records(snapshotId, tableId, cursor, take);

  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(swrKey, () =>
    snapshotApi.listRecords(snapshotId, tableId, cursor, take)
  );

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
          const recordIndex = newRecords.findIndex((r) => r.id === op.id);

          if (op.op === "update") {
            if (recordIndex === -1) {
              continue;
            }

            // Clone the record to avoid mutating the original cache
            const record = { ...newRecords[recordIndex] };

            // Update the data fields
            if (op.data) {
              Object.assign(record, op.data);
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
              id: op.id,
              ...(op.data ?? {}),
              __edited_fields: { __created: "NOW" },
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

  return {
    recordsResponse: data,
    isLoading,
    error,
    bulkUpdateRecords,
  };
};
