import { Injectable } from '@nestjs/common';
import type { Service, WorkbookId } from '@spinner/shared-types';
import { WSLogger } from '../logger';
import type { Connector } from '../remote-service/connectors/connector';
import type { AnyJsonTableSpec } from '../remote-service/connectors/library/custom-spec-registry';
import type { BaseJsonTableSpec } from '../remote-service/connectors/types';
import { ScratchGitService } from '../scratch-git/scratch-git.service';

/**
 * Represents a file to be created (exists in dirty branch but not in main)
 */
export interface FileToCreate {
  path: string;
  content: Record<string, unknown>;
}

/**
 * Represents a file to be updated (exists in both branches but differs)
 */
export interface FileToUpdate {
  path: string;
  content: Record<string, unknown>;
  remoteId: string;
}

/**
 * Represents a file to be deleted (exists in main but not in dirty)
 */
export interface FileToDelete {
  path: string;
  remoteId: string;
}

/**
 * Result of analyzing a data folder for publishing
 */
export interface FilesToPublish {
  creates: FileToCreate[];
  updates: FileToUpdate[];
  deletes: FileToDelete[];
}

/**
 * Service responsible for publishing data folder files to remote services.
 * Uses scratch-git as the source of truth instead of the workbook database.
 *
 * Flow:
 * 1. Get folder diff (dirty vs main branch) to identify changes
 * 2. Process creates/updates/deletes through the connector
 * 3. Update git files with results (new IDs for creates, remove deletes)
 */
@Injectable()
export class DataFolderPublishingService {
  constructor(private readonly scratchGitService: ScratchGitService) {}

  /**
   * Analyzes a data folder to determine which files need to be published.
   * Uses git diff between dirty and main branches.
   *
   * @param workbookId - The workbook ID (used as repo ID in scratch-git)
   * @param folderPath - The folder path within the repo (e.g., "/BLOG - Blog Posts Premium")
   * @param tableSpec - The table spec to extract ID field name
   */
  async getFilesToPublish(
    workbookId: WorkbookId,
    folderPath: string,
    tableSpec: BaseJsonTableSpec,
  ): Promise<FilesToPublish> {
    const result: FilesToPublish = {
      creates: [],
      updates: [],
      deletes: [],
    };

    // Get the diff for this folder
    const diff = await this.scratchGitService.getFolderDiff(workbookId, folderPath);

    WSLogger.debug({
      source: 'DataFolderPublishingService',
      message: 'Got folder diff',
      workbookId,
      folderPath,
      diffCount: diff.length,
      diff: diff.map((d) => ({ path: d.path, status: d.status })),
    });

    const idField = tableSpec.idColumnRemoteId || 'id';

    for (const file of diff) {
      // Only process JSON files
      if (!file.path.endsWith('.json')) {
        continue;
      }

      if (file.status === 'added') {
        // New file - read from dirty branch
        const fileData = await this.scratchGitService.getRepoFile(workbookId, 'dirty', file.path);
        if (fileData) {
          try {
            const content = JSON.parse(fileData.content) as Record<string, unknown>;
            result.creates.push({ path: file.path, content });
          } catch (e) {
            WSLogger.warn({
              source: 'DataFolderPublishingService',
              message: 'Failed to parse JSON file for create',
              path: file.path,
              error: e,
            });
          }
        }
      } else if (file.status === 'modified') {
        // Modified file - read from dirty branch, get ID from content
        const fileData = await this.scratchGitService.getRepoFile(workbookId, 'dirty', file.path);
        if (fileData) {
          try {
            const content = JSON.parse(fileData.content) as Record<string, unknown>;
            const remoteId = content[idField] as string;
            if (remoteId) {
              result.updates.push({ path: file.path, content, remoteId });
            } else {
              WSLogger.warn({
                source: 'DataFolderPublishingService',
                message: 'Modified file has no remote ID, treating as create',
                path: file.path,
              });
              result.creates.push({ path: file.path, content });
            }
          } catch (e) {
            WSLogger.warn({
              source: 'DataFolderPublishingService',
              message: 'Failed to parse JSON file for update',
              path: file.path,
              error: e,
            });
          }
        }
      } else if (file.status === 'deleted') {
        // Deleted file - read from main branch to get the remote ID
        const fileData = await this.scratchGitService.getRepoFile(workbookId, 'main', file.path);
        if (fileData) {
          try {
            const content = JSON.parse(fileData.content) as Record<string, unknown>;
            const remoteId = content[idField] as string;
            if (remoteId) {
              result.deletes.push({ path: file.path, remoteId });
            } else {
              WSLogger.warn({
                source: 'DataFolderPublishingService',
                message: 'Deleted file has no remote ID, skipping',
                path: file.path,
              });
            }
          } catch (e) {
            WSLogger.warn({
              source: 'DataFolderPublishingService',
              message: 'Failed to parse JSON file for delete',
              path: file.path,
              error: e,
            });
          }
        }
      }
    }

    WSLogger.info({
      source: 'DataFolderPublishingService',
      message: 'Files to publish',
      workbookId,
      folderPath,
      creates: result.creates.length,
      updates: result.updates.length,
      deletes: result.deletes.length,
    });

    return result;
  }

  /**
   * Publish new files (creates) to the connector.
   * After successful creation, updates the JSON files with the new remote IDs.
   */
  async publishCreates<S extends Service>(
    workbookId: WorkbookId,
    connector: Connector<S>,
    tableSpec: AnyJsonTableSpec,
    files: FileToCreate[],
    onProgress: (count: number) => Promise<void>,
  ): Promise<void> {
    if (files.length === 0) {
      return;
    }

    const batchSize = connector.getBatchSize('create');
    const idField = tableSpec.idColumnRemoteId || 'id';

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      // Prepare files for the connector (ConnectorFile is Record<string, unknown>)
      const connectorFiles = batch.map((file) => file.content);

      // Send to connector
      const returnedFiles = await connector.createRecords(tableSpec, {}, connectorFiles);

      // Update files with the new remote IDs
      const filesToCommit: Array<{ path: string; content: string }> = [];

      for (let j = 0; j < returnedFiles.length; j++) {
        const returned = returnedFiles[j];
        const originalFile = batch[j];

        // Extract the id from the returned file
        const remoteId = returned[idField] || returned.id || returned._id;

        if (remoteId) {
          // Update the content with the new ID
          const updatedContent = { ...originalFile.content, ...returned };

          filesToCommit.push({
            path: originalFile.path,
            content: JSON.stringify(updatedContent, null, 2),
          });

          WSLogger.debug({
            source: 'DataFolderPublishingService',
            message: 'Created record, updating file with new ID',
            path: originalFile.path,
            remoteId: typeof remoteId === 'string' ? remoteId : JSON.stringify(remoteId),
          });
        }
      }

      // Commit updated files to dirty branch
      if (filesToCommit.length > 0) {
        await this.scratchGitService.commitFilesToBranch(
          workbookId,
          'dirty',
          filesToCommit,
          `Published ${filesToCommit.length} new records`,
        );
      }

      await onProgress(batch.length);
    }
  }

  /**
   * Publish modified files (updates) to the connector.
   * The files are already updated in the dirty branch, we just need to send to connector.
   */
  async publishUpdates<S extends Service>(
    workbookId: WorkbookId,
    connector: Connector<S>,
    tableSpec: AnyJsonTableSpec,
    files: FileToUpdate[],
    onProgress: (count: number) => Promise<void>,
  ): Promise<void> {
    if (files.length === 0) {
      return;
    }

    const batchSize = connector.getBatchSize('update');

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      // Prepare files for the connector (ConnectorFile is Record<string, unknown>)
      // The content should already have the id field set
      const connectorFiles = batch.map((file) => file.content);

      // Send to connector
      await connector.updateRecords(tableSpec, {}, connectorFiles);

      WSLogger.debug({
        source: 'DataFolderPublishingService',
        message: 'Updated records',
        count: batch.length,
        paths: batch.map((f) => f.path),
      });

      await onProgress(batch.length);
    }
  }

  /**
   * Publish deleted files to the connector.
   * After successful deletion, the files are already gone from dirty branch
   * (that's how we detected them as deleted).
   */
  async publishDeletes<S extends Service>(
    workbookId: WorkbookId,
    connector: Connector<S>,
    tableSpec: AnyJsonTableSpec,
    files: FileToDelete[],
    onProgress: (count: number) => Promise<void>,
  ): Promise<void> {
    if (files.length === 0) {
      return;
    }

    const batchSize = connector.getBatchSize('delete');
    const idField = tableSpec.idColumnRemoteId || 'id';

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      // Prepare files for the connector (just need the id field)
      const connectorFiles = batch.map((file) => ({ [idField]: file.remoteId, id: file.remoteId }));

      // Send to connector
      await connector.deleteRecords(tableSpec, connectorFiles);

      WSLogger.debug({
        source: 'DataFolderPublishingService',
        message: 'Deleted records',
        count: batch.length,
        remoteIds: batch.map((f) => f.remoteId),
      });

      await onProgress(batch.length);
    }
  }

  /**
   * Convenience method to publish all changes in a data folder.
   * Processes creates, updates, and deletes in order.
   */
  async publishAll<S extends Service>(
    workbookId: WorkbookId,
    folderPath: string,
    connector: Connector<S>,
    tableSpec: AnyJsonTableSpec,
    onProgress: (phase: 'creates' | 'updates' | 'deletes', count: number) => Promise<void>,
  ): Promise<{ creates: number; updates: number; deletes: number }> {
    // Get files to publish
    const filesToPublish = await this.getFilesToPublish(workbookId, folderPath, tableSpec);

    // Publish creates
    await this.publishCreates(workbookId, connector, tableSpec, filesToPublish.creates, (count) =>
      onProgress('creates', count),
    );

    // Publish updates
    await this.publishUpdates(workbookId, connector, tableSpec, filesToPublish.updates, (count) =>
      onProgress('updates', count),
    );

    // Publish deletes
    await this.publishDeletes(workbookId, connector, tableSpec, filesToPublish.deletes, (count) =>
      onProgress('deletes', count),
    );

    return {
      creates: filesToPublish.creates.length,
      updates: filesToPublish.updates.length,
      deletes: filesToPublish.deletes.length,
    };
  }
}
