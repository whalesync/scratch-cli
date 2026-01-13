import { Injectable } from '@nestjs/common';
import type { FileId, Service, SnapshotColumnSettingsMap, SnapshotRecordId, WorkbookId } from '@spinner/shared-types';
import _ from 'lodash';
import type { WorkbookCluster } from '../db/cluster-types';
import type { Connector } from '../remote-service/connectors/connector';
import type { TableSpecs } from '../remote-service/connectors/library/custom-spec-registry';
import type {
  BaseColumnSpec,
  BaseTableSpec,
  ConnectorRecord,
  SnapshotRecordSanitizedForUpdate,
} from '../remote-service/connectors/types';
import { normalizeFolderName } from './util';
import { convertFileToConnectorRecord, FileDbRecord } from './workbook-db';
import { WorkbookDbService } from './workbook-db.service';

/**
 * Extracts the file name and path for a file based on the title column value.
 * Falls back to the provided fallback name if no title column is configured or value is not found.
 *
 * @param file - The file record containing the current path
 * @param fields - The record fields to extract the title from
 * @param tableSpec - Table specification containing title column info
 * @param fallbackName - Name to use if no title is found (e.g., remoteId)
 * @returns Object with fileName and filePath
 */
function extractFileNameAndPath<T extends BaseColumnSpec>(
  file: FileDbRecord,
  fields: Record<string, unknown>,
  tableSpec: BaseTableSpec<T>,
  fallbackName: string,
): { fileName: string; filePath: string } {
  let fileName = fallbackName;

  if (tableSpec.titleColumnRemoteId) {
    const column = tableSpec.columns.find((c) => _.isEqual(c.id.remoteId, tableSpec.titleColumnRemoteId));
    const titleValue = fields[column?.id.wsId ?? ''];
    if (titleValue && typeof titleValue === 'string') {
      fileName = titleValue;
    }
  }

  if (!fileName.endsWith('.md')) {
    fileName += '.md';
  }
  fileName = normalizeFolderName(fileName);

  // Compute the path by replacing the file name in the original path
  const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
  const filePath = folderPath === '' ? `/${fileName}` : `${folderPath}/${fileName}`;

  return { fileName, filePath };
}

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
          const originalRecord = records[i];

          if (returnedRecord.remoteId) {
            const { fileName, filePath } = extractFileNameAndPath(
              originalFile,
              originalRecord.fields,
              tableSpec,
              returnedRecord.remoteId,
            );

            await this.workbookDbService.workbookDb.updateFileAfterPublishing(
              workbook.id as WorkbookId,
              originalFile.id as FileId,
              returnedRecord.remoteId,
              fileName,
              filePath,
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
      async (files, trx) => {
        // Filter files that have remote IDs and build records
        const filesToUpdate = files.filter((file) => file.remote_id);
        const records: SnapshotRecordSanitizedForUpdate[] = filesToUpdate.map((file) => {
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

          // Update file names and paths if title column changed
          for (let i = 0; i < filesToUpdate.length; i++) {
            const originalFile = filesToUpdate[i];
            const record = records[i];

            const { fileName, filePath } = extractFileNameAndPath(
              originalFile,
              record.partialFields,
              tableSpec,
              originalFile.remote_id!,
            );

            await this.workbookDbService.workbookDb.updateFileAfterPublishing(
              workbook.id as WorkbookId,
              originalFile.id as FileId,
              originalFile.remote_id!,
              fileName,
              filePath,
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
