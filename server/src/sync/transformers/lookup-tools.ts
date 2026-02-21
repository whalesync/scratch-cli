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
    async getDestinationPathForSourceFk(
      sourceFkValue: string,
      referencedDataFolderId: DataFolderId,
    ): Promise<string | null> {
      // Look up the destination file path for the source FK value.
      // The FK value is a remote ID from the source system, and we need to find
      // the corresponding destination file path using SyncRemoteIdMapping.
      const mapping = await db.client.syncRemoteIdMapping.findFirst({
        where: {
          syncId,
          dataFolderId: referencedDataFolderId,
          sourceRemoteId: sourceFkValue,
        },
        select: { destinationFilePath: true },
      });

      return mapping?.destinationFilePath ?? null;
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
        // Extract the field using the dot-path.
        // Normalize undefined (missing path) to null so callers can distinguish
        // "record not found" (undefined) from "field is null/missing" (null).
        const value: unknown = get(cachedRecord.recordData as object, fieldPath);
        return value === undefined ? null : value;
      }

      // Record not found in cache — return undefined as a sentinel value.
      // Callers can distinguish this from a null field value in the referenced record.
      return undefined;
    },
  };
}
