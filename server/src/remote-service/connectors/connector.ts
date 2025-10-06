import { ConnectorAccount, Service } from '@prisma/client';
import { JsonSafeObject } from 'src/utils/objects';
import { AnyTableSpec, TableSpecs } from './library/custom-spec-registry';
import {
  ConnectorRecord,
  EntityId,
  ExistingSnapshotRecord,
  SnapshotRecordSanitizedForUpdate,
  TablePreview,
} from './types';

export abstract class Connector<T extends Service, TConnectorProgress extends JsonSafeObject = JsonSafeObject> {
  abstract readonly service: T;

  abstract testConnection(): Promise<void>;

  abstract listTables(account: ConnectorAccount): Promise<TablePreview[]>;

  abstract fetchTableSpec(id: EntityId, account: ConnectorAccount): Promise<TableSpecs[T]>;

  abstract downloadTableRecords(
    tableSpec: TableSpecs[T],
    callback: (params: { records: ConnectorRecord[]; connectorProgress?: TConnectorProgress }) => Promise<void>,
    account: ConnectorAccount,
    progress: TConnectorProgress,
  ): Promise<void>;

  /**
   * Sometimes accessing curtain record fields requires a more expensive api call that usually cannot be batched.
   * For example:
   * - Notion's pageContent field
   * - Youtube's caption field (for us defined as the video's first english caption)
   * We should be able to download these fields on demand to save on api calls.
   * Youtube, for example can list videos in batches of 100 for 1 api credit per batch,
   * while fetching the captions for a video consumes 50 credits per video.
   */
  abstract downloadRecordDeep?(
    tableSpec: TableSpecs[T],
    existingRecord: ExistingSnapshotRecord,
    /** Null indicates all possible fields */
    fields: string[] | null,
    callback: (records: ConnectorRecord[]) => Promise<void>,
    account: ConnectorAccount,
  ): Promise<void>;

  /**
   * Sanitize the record for update. Usually involves removing fields that are not touched.
   * @param record - The record to sanitize.
   * @param tableSpec - The table spec to sanitize the record for.
   * @returns The sanitized record.
   */
  sanitizeRecordForUpdate(record: ExistingSnapshotRecord, tableSpec: TableSpecs[T]): SnapshotRecordSanitizedForUpdate {
    const editedFieldNames = (tableSpec as AnyTableSpec).columns
      .map((c) => c.id.wsId)
      .filter((colWsId) => !!record.__edited_fields[colWsId]);
    const editedFields = Object.fromEntries(
      Object.entries(record.fields).filter(([fieldName]) => editedFieldNames.includes(fieldName)),
    );

    return {
      id: {
        wsId: record.id.wsId,
        remoteId: record.id.remoteId,
      },
      partialFields: editedFields,
    };
  }

  abstract getBatchSize(operation: 'create' | 'update' | 'delete'): number;

  abstract createRecords(
    tableSpec: TableSpecs[T],
    records: { wsId: string; fields: Record<string, unknown> }[],
    account: ConnectorAccount,
  ): Promise<{ wsId: string; remoteId: string }[]>;

  // TODO: Should this return updated records?
  abstract updateRecords(
    tableSpec: TableSpecs[T],
    records: SnapshotRecordSanitizedForUpdate[],
    account: ConnectorAccount,
  ): Promise<void>;

  abstract deleteRecords(
    tableSpec: TableSpecs[T],
    recordIds: { wsId: string; remoteId: string }[],
    account: ConnectorAccount,
  ): Promise<void>;
}
