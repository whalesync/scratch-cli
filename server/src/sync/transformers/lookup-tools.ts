import { DataFolderId, SyncId } from '@spinner/shared-types';
import get from 'lodash/get';
import { DbService } from 'src/db/db.service';
import { LookupTools } from './transformer.types';

/**
 * Factory function to create LookupTools for a specific sync context.
 *
 * @param db - Database service
 * @param syncId - The sync ID for looking up mappings
 */
export function createLookupTools(db: DbService, syncId: SyncId): LookupTools {
  return {
    async getDestinationIdForSourceFk(
      sourceFkValue: string,
      referencedDataFolderId: DataFolderId,
    ): Promise<string | null> {
      // Look up the destination remote ID for the source FK value
      // The FK value is a remote ID from the source system, and we need to find
      // the corresponding destination remote ID using SyncRemoteIdMapping
      const mapping = await db.client.syncRemoteIdMapping.findFirst({
        where: {
          syncId,
          dataFolderId: referencedDataFolderId,
          sourceRemoteId: sourceFkValue,
        },
        select: { destinationRemoteId: true },
      });

      return mapping?.destinationRemoteId ?? null;
    },

    async lookupFieldFromFkRecord(
      sourceFkValue: string,
      referencedDataFolderId: DataFolderId,
      fieldPath: string,
    ): Promise<unknown> {
      // First, try to find the FK record in the cache
      const cachedRecord = await db.client.syncForeignKeyRecord.findFirst({
        where: {
          syncId,
          dataFolderId: referencedDataFolderId,
          foreignKeyValue: sourceFkValue,
        },
        select: { recordData: true },
      });

      if (cachedRecord?.recordData) {
        // Extract the field using the dot-path
        return get(cachedRecord.recordData as object, fieldPath);
      }

      // If not in cache, return null - the caller should handle fetching if needed
      // In the future, we could add logic here to fetch the record from the source
      return null;
    },
  };
}
