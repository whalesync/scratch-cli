import { ConnectorAccount } from '@prisma/client';
import { Service } from '@spinner/shared-types';
import { JsonSafeObject } from 'src/utils/objects';
import type { SnapshotColumnSettingsMap } from '../../workbook/types';
import { AnyTableSpec, TableSpecs } from './library/custom-spec-registry';
import {
  BaseJsonTableSpec,
  ConnectorErrorDetails,
  ConnectorFile,
  EntityId,
  ExistingSnapshotRecord,
  SnapshotRecordSanitizedForUpdate,
  TablePreview,
} from './types';

/**
 * Defines a utility that parses the user provided parameters for a given service into a set of credentials and extras.
 * This is usefule for services that need pre parsing of the user provided parameters for a better user experience.
 * For example: WordPress requires an endpoint and users most of the time will not have the exact one we need so we do a couple transformations to get the correct one.
 */
export abstract class AuthParser<T extends Service> {
  abstract readonly service: T;

  /**
   * Parse the authentication credentials (apiKey, username, password, endpoint, etc.) for the service.
   * @param userProvidedParams The user provided parameters to parse.
   * @returns The parsed user provided parameters into a set of credentials and extras.
   */
  abstract parseUserProvidedParams(params: {
    userProvidedParams: Record<string, string | undefined>;
  }): Promise<{ credentials: Record<string, string>; extras: Record<string, string> }>;
}

/**
 * Defines a utility that abstracts the interaction with a data source.
 */
export abstract class Connector<T extends Service, TConnectorProgress extends JsonSafeObject = JsonSafeObject> {
  abstract readonly service: T;

  /**
   * Get the display name for for the data service the connector operates on
   * @returns The display name for the connector.
   */
  static readonly displayName: string;

  /**
   * Test the current state of the connection to the Datasource.
   * @throws Error if the connection is not valid.
   */
  abstract testConnection(): Promise<void>;

  /**
   * List the tables available in the data source that can be used for snapshots
   * @returns A list of table previews.
   * @throws Error if the tables cannot be listed.
   */
  abstract listTables(): Promise<TablePreview[]>;

  /**
   * Fetch the JSON Table Spec for a table directly from the remote API.
   * Returns a spec that includes metadata and a TSchema describing valid field values.
   * Uses field slugs/names as property keys in the schema.
   *
   * @param id The id of the table to fetch the JSON Table Spec for.
   * @returns A BaseJsonTableSpec containing table metadata and JSON Schema.
   */
  abstract fetchJsonTableSpec(id: EntityId): Promise<BaseJsonTableSpec>;

  /**
   * Get a new file template for the given table spec.
   * @param tableSpec The table spec to get the new file template for.
   * @returns The new file template.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getNewFile(tableSpec: BaseJsonTableSpec): Promise<Record<string, unknown>> {
    return Promise.resolve({});
  }

  /**
   * Does a full poll of target remote table and pulls all of the available records as JSON files.
   * This is the new method that uses JSON schema instead of column-based specs.
   * @param tableSpec The JSON table spec to pull records for.
   * @param callback The callback that will process batches of files as they are pulled.
   * @param progress The progress object to update with the pull progress.
   */
  abstract pullRecordFiles(
    tableSpec: BaseJsonTableSpec,
    callback: (params: { files: ConnectorFile[]; connectorProgress?: TConnectorProgress }) => Promise<void>,
    progress: TConnectorProgress,
  ): Promise<void>;

  /**
   * Sometimes accessing certain record fields requires a more expensive api call that usually cannot be batched.
   * For example:
   * - Notion's pageContent field
   * - Youtube's caption field (for us defined as the video's first english caption)
   * We should be able to pull these fields on demand to save on api calls.
   * Youtube, for example can list videos in batches of 100 for 1 api credit per batch,
   * while fetching the captions for a video consumes 50 credits per video.
   */
  abstract pullRecordDeep?(
    tableSpec: TableSpecs[T],
    existingRecord: ExistingSnapshotRecord,
    /** Null indicates all possible fields */
    fields: string[] | null,
    callback: (files: ConnectorFile[]) => Promise<void>,
    account: ConnectorAccount,
  ): Promise<void>;

  /**
   * Validate files against the table schema before publishing.
   * This is an optional method that connectors can override to provide custom validation logic.
   * By default, returns undefined to indicate that the connector does not support validation.
   *
   * @param tableSpec - The table spec to validate files against.
   * @param files - Array of files to validate, each containing filename, optional id, and data as key-value pairs.
   * @returns Array of validation results, each containing the original file data plus a publishable boolean,
   *          or undefined if the connector does not support validation.
   */
  validateFiles?(
    tableSpec: TableSpecs[T],
    files: { filename: string; id?: string; data: Record<string, unknown> }[],
  ): Promise<
    { filename: string; id?: string; data: Record<string, unknown>; publishable: boolean; errors?: string[] }[]
  >;

  /**
   * Sanitize the record for update. Usually involves removing fields that are not touched or are scratch fields that the connector does not know about.
   * @param record - The record to sanitize.
   * @param tableSpec - The table spec to sanitize the record for.
   * @returns The sanitized record.
   */
  sanitizeRecordForUpdate(record: ExistingSnapshotRecord, tableSpec: TableSpecs[T]): SnapshotRecordSanitizedForUpdate {
    const editedFieldNames = (tableSpec as AnyTableSpec).columns
      .filter((c) => !c.metadata?.scratch)
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

  /**
   * Get the batch size for a given operation.
   * @param operation The operation to get the batch size for.
   * @returns The batch size for the given operation. Must be a value greater than 0.
   */
  abstract getBatchSize(operation: 'create' | 'update' | 'delete'): number;

  /**
   * Attempts to push creates to the data source.
   * @param tableSpec - The table spec to create records for.
   * @param files - The files to create.
   * @throws Error if there is a problem creating the records.
   */
  abstract createRecords(
    tableSpec: BaseJsonTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<ConnectorFile[]>;

  /**
   * Attempts to push updates to the data source.
   * @param tableSpec - The table spec to update records for.
   * @param files - The files to update.
   * @throws Error if there is a problem updating the records.
   */
  abstract updateRecords(
    tableSpec: BaseJsonTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<void>;

  /**
   * Delete records from the data source
   * @param tableSpec - The table spec to delete records from.
   * @param files - The files to delete.
   * @throws Error if there is a problem deleting the records.
   */
  abstract deleteRecords(tableSpec: BaseJsonTableSpec, files: ConnectorFile[]): Promise<void>;

  /**
   * Evaluate the error object in the context of the connector and return some standardised error details that can be return to a user or logged.
   * @param error - The error to evaluate.
   * @returns The connector error details.
   */
  abstract extractConnectorErrorDetails(error: unknown): ConnectorErrorDetails;
}
