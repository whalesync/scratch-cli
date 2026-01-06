import { Injectable } from '@nestjs/common';
import type { FileId, Service, SnapshotColumnSettingsMap, SnapshotRecordId, WorkbookId } from '@spinner/shared-types';
import type { WorkbookCluster } from '../db/cluster-types';
import type { Connector } from '../remote-service/connectors/connector';
import type { TableSpecs } from '../remote-service/connectors/library/custom-spec-registry';
import type {
  BaseColumnSpec,
  ConnectorRecord,
  SnapshotRecordSanitizedForUpdate,
} from '../remote-service/connectors/types';
import { convertFileToConnectorRecord } from './workbook-db';
import { WorkbookDbService } from './workbook-db.service';

/**
 * Service responsible for publishing file changes to remote services.
 * Handles creates, updates, and deletes operations with progress tracking.
 */
@Injectable()
export class FilePublishingService {
  constructor(private readonly workbookDbService: WorkbookDbService) {}

  /**
   * Publishes newly created files to a remote table with progress tracking.
   * Processes files marked as dirty and created (original === null).
   *
   * @param workbook - The workbook containing the files
   * @param connector - The connector to publish to
   * @param table - The target table specification
   * @param tableSpec - Table specification for the connector
   * @param onProgress - Callback invoked with the count of processed files
   */
  async publishCreatesToTableWithProgress<S extends Service>(
    workbook: WorkbookCluster.Workbook,
    connector: Connector<S>,
    table: WorkbookCluster.SnapshotTable,
    tableSpec: TableSpecs[S],
    onProgress: (count: number) => Promise<void>,
  ): Promise<void> {
    await this.workbookDbService.workbookDb.forAllDirtyFiles(
      workbook.id as WorkbookId,
      'create',
      connector.getBatchSize('create'),
      async (files, trx) => {
        // Convert files to connector records
        const records: ConnectorRecord[] = files.map((file) =>
          convertFileToConnectorRecord<BaseColumnSpec>(workbook.id as WorkbookId, file, tableSpec),
        );

        // Create records via connector
        const returnedRecords = await connector.createRecords(
          tableSpec,
          table.columnSettings as SnapshotColumnSettingsMap,
          records.map((r) => ({ wsId: r.id, fields: r.fields })),
        );

        // Update files with remote IDs using WorkbookDb method
        for (let i = 0; i < returnedRecords.length; i++) {
          const returnedRecord = returnedRecords[i];
          const originalFile = files[i];

          if (returnedRecord.remoteId) {
            await this.workbookDbService.workbookDb.updateFileRemoteId(
              workbook.id as WorkbookId,
              originalFile.id as FileId,
              returnedRecord.remoteId,
              trx,
            );
          }
        }

        // Call progress callback
        await onProgress(files.length);
      },
      true,
    );
  }

  /**
   * Publishes updated files to a remote table with progress tracking.
   * Processes files marked as dirty and modified (original !== null, not deleted).
   *
   * @param workbook - The workbook containing the files
   * @param connector - The connector to publish to
   * @param table - The target table specification
   * @param tableSpec - Table specification for the connector
   * @param onProgress - Callback invoked with the count of processed files
   */
  async publishUpdatesToTableWithProgress<S extends Service>(
    workbook: WorkbookCluster.Workbook,
    connector: Connector<S>,
    table: WorkbookCluster.SnapshotTable,
    tableSpec: TableSpecs[S],
    onProgress: (count: number) => Promise<void>,
  ): Promise<void> {
    await this.workbookDbService.workbookDb.forAllDirtyFiles(
      workbook.id as WorkbookId,
      'update',
      connector.getBatchSize('update'),
      async (files) => {
        // Convert files to connector records with proper type structure
        const records: SnapshotRecordSanitizedForUpdate[] = files
          .filter((file) => file.remote_id) // Only update files that have remote IDs
          .map((file) => {
            const connectorRecord = convertFileToConnectorRecord<BaseColumnSpec>(
              workbook.id as WorkbookId,
              file,
              tableSpec,
            );
            return {
              id: {
                wsId: connectorRecord.id as SnapshotRecordId,
                remoteId: file.remote_id!,
              },
              partialFields: connectorRecord.fields,
            };
          });

        if (records.length > 0) {
          await connector.updateRecords(tableSpec, table.columnSettings as SnapshotColumnSettingsMap, records);
        }

        // Call progress callback
        await onProgress(files.length);
      },
      true,
    );
  }

  /**
   * Publishes deleted files to a remote table with progress tracking.
   * Processes files marked as dirty and deleted.
   *
   * @param workbook - The workbook containing the files
   * @param connector - The connector to publish to
   * @param table - The target table specification
   * @param tableSpec - Table specification for the connector
   * @param onProgress - Callback invoked with the count of processed files
   */
  async publishDeletesToTableWithProgress<S extends Service>(
    workbook: WorkbookCluster.Workbook,
    connector: Connector<S>,
    table: WorkbookCluster.SnapshotTable,
    tableSpec: TableSpecs[S],
    onProgress: (count: number) => Promise<void>,
  ): Promise<void> {
    await this.workbookDbService.workbookDb.forAllDirtyFiles(
      workbook.id as WorkbookId,
      'delete',
      connector.getBatchSize('delete'),
      async (files, trx) => {
        // Filter files that have remote IDs
        const fileIdsToDelete = files
          .filter((file) => file.remote_id)
          .map((file) => ({
            wsId: file.id,
            remoteId: file.remote_id!,
          }));

        if (fileIdsToDelete.length > 0) {
          // Delete records via connector
          await connector.deleteRecords(tableSpec, fileIdsToDelete);

          // Remove files from the database using WorkbookDb method (hard delete)
          const fileIds = files.map((file) => file.id as FileId);
          await this.workbookDbService.workbookDb.hardDeleteFiles(workbook.id as WorkbookId, fileIds, trx);
        }

        // Call progress callback
        await onProgress(files.length);
      },
      true,
    );
  }
}
