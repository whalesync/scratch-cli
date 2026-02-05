import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthType, ConnectorAccount } from '@prisma/client';
import { createConnectorAccountId, DataFolderId, Service, WorkbookId } from '@spinner/shared-types';
import { createHash } from 'crypto';
import * as path from 'path';
import { CliConnectorCredentials } from 'src/auth/types';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { DbService } from 'src/db/db.service';
import { JobService } from 'src/job/job.service';
import { WSLogger } from 'src/logger';
import { PostHogEventName, PostHogService } from 'src/posthog/posthog.service';
import { DecryptedCredentials } from 'src/remote-service/connector-account/types/encrypted-credentials.interface';
import { ConnectorsService } from 'src/remote-service/connectors/connectors.service';
import { TablePreview } from 'src/remote-service/connectors/types';
import { DIRTY_BRANCH, RepoFileRef, ScratchGitService } from 'src/scratch-git/scratch-git.service';
import { Actor } from 'src/users/types';
import { DataFolderService } from 'src/workbook/data-folder.service';
import { DataFolderEntity } from 'src/workbook/entities/data-folder.entity';
import { Workbook } from 'src/workbook/entities/workbook.entity';
import { WorkbookDbService } from 'src/workbook/workbook-db.service';
import { WorkbookService } from 'src/workbook/workbook.service';
import { BullEnqueuerService } from 'src/worker-enqueuer/bull-enqueuer.service';
import { PullLinkedFolderFilesPublicProgress } from 'src/worker/jobs/job-definitions/pull-linked-folder-files.job';
import { ValidatedFolderMetadataDto } from './dtos/download-folder.dto';
import {
  GetFolderFilesResponseDto,
  PutFolderFilesResponseDto,
  ValidatedPutFolderFilesRequestDto,
} from './dtos/folder-files.dto';
import { JobStatusResponseDto } from './dtos/job-status.dto';
import { ListTablesResponseDto, TableInfo } from './dtos/list-tables.dto';
import { TriggerPullResponseDto } from './dtos/trigger-pull.dto';

/**
 * Represents a file from the dirty branch (server state)
 */
interface DirtyFile {
  name: string;
  path: string;
  content: string;
}

@Injectable()
export class CliService {
  constructor(
    private readonly config: ScratchpadConfigService,
    private readonly connectorsService: ConnectorsService,
    private readonly posthogService: PostHogService,
    private readonly workbookService: WorkbookService,
    private readonly dataFolderService: DataFolderService,
    private readonly workbookDbService: WorkbookDbService,
    private readonly scratchGitService: ScratchGitService,
    private readonly jobService: JobService,
    private readonly db: DbService,
    private readonly bullEnqueuerService: BullEnqueuerService,
  ) {}

  /**
   * Computes SHA256 hash of content
   */
  private hash(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Converts a lowercase service name (e.g., "notion", "airtable") to the Service enum value.
   * Returns undefined if the service name is not valid.
   */
  private parseServiceName(serviceName: string): Service | undefined {
    const upperService = serviceName.toUpperCase();
    const serviceValues = Object.values(Service) as string[];
    if (serviceValues.includes(upperService)) {
      return upperService as Service;
    }
    return undefined;
  }

  private async getConnectorFromCredentials(credentials: CliConnectorCredentials, serviceName: string) {
    const service = this.parseServiceName(serviceName);
    if (!service) {
      throw new BadRequestException(`Invalid service: ${serviceName} provided`);
    }

    // Parse user-provided params if an auth parser exists for this service
    let parsedCredentials: Record<string, string> = credentials.params ?? {};
    const authParser = this.connectorsService.getAuthParser({ service: service });
    if (authParser) {
      const result = await authParser.parseUserProvidedParams({
        userProvidedParams: credentials.params ?? {},
      });
      parsedCredentials = result.credentials;
    }

    // Create an in-memory ConnectorAccount object (not persisted to database)
    const inMemoryAccount: ConnectorAccount = {
      id: createConnectorAccountId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: null,
      organizationId: 'cli-org',
      service: service,
      displayName: 'CLI Connection',
      authType: AuthType.USER_PROVIDED_PARAMS,
      encryptedCredentials: {},
      healthStatus: null,
      healthStatusLastCheckedAt: null,
      healthStatusMessage: null,
      modifier: null,
      extras: null,
    };

    // Create an in-memory DecryptedCredentials object
    const decryptedCredentials: DecryptedCredentials = parsedCredentials;

    // Get the connector using the in-memory objects
    return this.connectorsService.getConnector({
      service,
      connectorAccount: inMemoryAccount,
      decryptedCredentials,
    });
  }

  /**
   * Lists all workbooks for the authenticated user.
   */
  async listWorkbooks(actor: Actor): Promise<Workbook[]> {
    const workbooks = await this.workbookService.findAllForUser(actor, 'updatedAt', 'desc');

    this.posthogService.captureEvent(PostHogEventName.CLI_LIST_WORKBOOKS, actor.userId, {
      workbookCount: workbooks.length,
    });

    return workbooks.map((w) => new Workbook(w));
  }

  /**
   * Lists all data folders in a workbook.
   */
  async listDataFolders(workbookId: WorkbookId, actor: Actor): Promise<DataFolderEntity[]> {
    const folders = await this.dataFolderService.listAll(workbookId, actor);

    this.posthogService.captureEvent(PostHogEventName.CLI_LIST_DATA_FOLDERS, actor.userId, {
      workbookId,
      folderCount: folders.length,
    });

    return folders;
  }

  /**
   * Gets a list of all available tables with their JSON Schema specs
   */
  async listTables(credentials: CliConnectorCredentials, actor?: Actor): Promise<ListTablesResponseDto> {
    try {
      const connector = await this.getConnectorFromCredentials(credentials, credentials.service);

      // Check if the connector supports fetchJsonTableSpec
      if (!connector.fetchJsonTableSpec) {
        return {
          error: `The ${credentials.service} connector does not support JSON Schema specs`,
        };
      }

      const tablePreviews = await connector.listTables();

      const tables: TableInfo[] = await Promise.all(
        tablePreviews.map(async (table: TablePreview) => {
          const tableInfo = new TableInfo();

          if (table.id.remoteId.length > 1) {
            tableInfo.siteId = table.id.remoteId[0];
            tableInfo.id = table.id.remoteId[1];
            // Site name might be in metadata
            if (table.metadata && 'siteName' in table.metadata) {
              tableInfo.siteName = table.metadata.siteName as string;
            } else if (table.metadata && 'baseName' in table.metadata) {
              tableInfo.siteName = table.metadata.baseName as string;
            }
          } else {
            tableInfo.id = table.id.remoteId[0];
          }

          tableInfo.name = table.displayName;
          const jsonSpec = await connector.fetchJsonTableSpec(table.id);
          tableInfo.slug = jsonSpec.slug;
          tableInfo.schema = jsonSpec.schema;
          tableInfo.idField = jsonSpec.idColumnRemoteId || 'id';

          return tableInfo;
        }),
      );

      const result = {
        tables,
      };

      if (actor) {
        this.posthogService.captureEvent(PostHogEventName.CLI_LIST_TABLES, actor.userId, {
          service: credentials.service,
          tableCount: result.tables?.length || 0,
        });
      }

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      WSLogger.error({
        source: 'CliService',
        message: 'Error listing tables',
        error: errorMessage,
      });
      return {
        error: errorMessage,
      };
    }
  }

  /**
   * Validates a file name to prevent path traversal attacks.
   * Returns the sanitized basename if valid, throws BadRequestException if invalid.
   *
   * IMPORTANT: This validation must be OS-agnostic since clients may run on
   * Windows, Linux, or macOS. We check for both forward and backward slashes
   * regardless of the server's OS.
   */
  private validateFileName(name: string): string {
    if (!name || name.trim() === '') {
      throw new BadRequestException('File name cannot be empty');
    }

    // Reject path traversal patterns (check before any processing)
    if (name.includes('..') || name.includes('\0')) {
      throw new BadRequestException(`Invalid file name: ${name} (path traversal not allowed)`);
    }

    // Reject any path separators - file names should not contain directory components
    // Check BOTH forward and backward slashes for cross-platform safety
    // (path.basename behavior varies by OS - on Linux, backslash is not a separator)
    if (name.includes('/') || name.includes('\\')) {
      throw new BadRequestException(`Invalid file name: ${name} (path separators not allowed)`);
    }

    // Get basename as a safety measure (should be same as name at this point)
    const basename = path.basename(name);

    // Double-check: reject if the original name had path components
    if (basename !== name) {
      throw new BadRequestException(`Invalid file name: ${name} (path traversal not allowed)`);
    }

    return basename;
  }

  /**
   * Gets all files from a folder on the dirty branch (simple storage layer).
   * No merge logic - just returns files.
   */
  async getFolderFiles(folderId: DataFolderId, actor: Actor): Promise<GetFolderFilesResponseDto> {
    const folder = await this.dataFolderService.findOne(folderId, actor);
    const workbookId = folder.workbookId;
    const rawPath = folder.path || folder.name;
    const folderPath = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;

    const dirtyFiles = await this.getDirtyBranchFiles(workbookId, folderPath);

    const folderMetadata: ValidatedFolderMetadataDto = {
      id: folder.id,
      name: folder.name,
      workbookId: folder.workbookId,
      connectorService: folder.connectorService ?? null,
      connectorDisplayName: folder.connectorDisplayName ?? null,
      tableId: folder.tableId ?? [],
      path: folder.path ?? null,
      schema: folder.schema ?? null,
      lastSyncTime: folder.lastSyncTime ?? null,
    };

    return {
      success: true,
      folder: folderMetadata,
      files: dirtyFiles.map((f) => ({
        name: f.name,
        content: f.content,
        hash: this.hash(f.content),
      })),
    };
  }

  /**
   * Writes pre-merged files to a folder on the dirty branch (simple storage layer).
   * The CLI performs all merge logic locally before calling this endpoint.
   */
  async putFolderFiles(
    folderId: DataFolderId,
    request: ValidatedPutFolderFilesRequestDto,
    actor: Actor,
  ): Promise<PutFolderFilesResponseDto> {
    const folder = await this.dataFolderService.findOne(folderId, actor);
    const workbookId = folder.workbookId;
    const rawPath = folder.path || folder.name;
    const folderPath = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;

    // Validate and write files
    if (request.files && request.files.length > 0) {
      const filesToCommit = request.files.map((f) => ({
        path: `${folderPath}/${this.validateFileName(f.name)}`,
        content: f.content,
      }));

      await this.scratchGitService.commitFilesToBranch(workbookId, DIRTY_BRANCH, filesToCommit, 'CLI upload');
    }

    // Handle deletions
    if (request.deletedFiles && request.deletedFiles.length > 0) {
      for (const fileName of request.deletedFiles) {
        const validatedName = this.validateFileName(fileName);
        await this.scratchGitService.deleteFile(workbookId, [`${folderPath}/${validatedName}`], 'CLI delete');
      }
    }

    // Compute sync hash
    const allHashes = (request.files || []).map((f) => this.hash(f.content)).join(':');
    const syncHash = this.hash(allHashes || 'empty');

    this.posthogService.captureEvent(PostHogEventName.CLI_UPLOAD_FOLDER, actor.userId, {
      folderId,
      workbookId,
      operation: 'upload',
      fileCount: request.files?.length ?? 0,
      deletedCount: request.deletedFiles?.length ?? 0,
    });

    return {
      success: true,
      syncHash,
    };
  }

  /**
   * Gets all files from the dirty branch for a folder.
   */
  private async getDirtyBranchFiles(workbookId: WorkbookId, folderPath: string): Promise<DirtyFile[]> {
    try {
      // List files in the folder on dirty branch
      const fileRefs = (await this.scratchGitService.listRepoFiles(
        workbookId,
        DIRTY_BRANCH,
        folderPath,
      )) as RepoFileRef[];

      // Fetch content for each file
      const files: DirtyFile[] = [];
      for (const ref of fileRefs) {
        if (ref.type === 'file') {
          try {
            const fileData = await this.scratchGitService.getRepoFile(workbookId, DIRTY_BRANCH, ref.path);
            files.push({
              name: ref.name,
              path: ref.path,
              content: fileData?.content ?? '{}',
            });
          } catch {
            // Skip files that can't be read
            WSLogger.warn({
              source: 'CliService',
              message: 'Could not read file from dirty branch',
              path: ref.path,
            });
          }
        }
      }

      return files;
    } catch (error) {
      // If folder doesn't exist yet, return empty array
      WSLogger.info({
        source: 'CliService',
        message: 'Folder not found on dirty branch, treating as empty',
        folderPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Triggers a pull job for a data folder in a workbook.
   * Uses enqueuePullLinkedFolderFilesJob to pull from the connector.
   */
  async triggerPull(workbookId: WorkbookId, dataFolderId: string, actor: Actor): Promise<TriggerPullResponseDto> {
    try {
      // Verify user has access to workbook
      const workbook = await this.workbookService.findOne(workbookId, actor);
      if (!workbook) {
        throw new NotFoundException(`Workbook ${workbookId} not found`);
      }

      // Find the data folder
      const dataFolder = await this.db.client.dataFolder.findFirst({
        where: {
          id: dataFolderId as DataFolderId,
          workbookId: workbook.id,
        },
      });

      if (!dataFolder) {
        return { error: `Data folder ${dataFolderId} not found in workbook ${workbookId}` };
      }

      // Set lock on the folder
      await this.db.client.dataFolder.update({
        where: { id: dataFolderId as DataFolderId },
        data: { lock: 'pull' },
      });

      // Build initial public progress
      const initialPublicProgress: PullLinkedFolderFilesPublicProgress = {
        totalFiles: 0,
        status: 'pending',
        folderId: dataFolder.id,
        folderName: dataFolder.name,
        connector: dataFolder.connectorService ?? '',
      };

      // Enqueue the pull job
      const job = await this.bullEnqueuerService.enqueuePullLinkedFolderFilesJob(
        workbookId,
        actor,
        dataFolderId as DataFolderId,
        initialPublicProgress,
      );

      this.posthogService.captureEvent(PostHogEventName.CLI_PULL, actor.userId, {
        workbookId,
        dataFolderId,
        source: 'cli-trigger',
      });

      return { jobId: job.id as string };
    } catch (error) {
      WSLogger.error({
        source: 'CliService',
        message: 'Error triggering pull',
        error: error instanceof Error ? error.message : 'Unknown error',
        workbookId,
        dataFolderId,
      });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { error: errorMessage };
    }
  }

  /**
   * Gets the status of a job by its BullMQ job ID.
   * Returns real-time progress information from the job queue.
   * Handles PullLinkedFolderFilesPublicProgress shape.
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponseDto> {
    try {
      const jobEntity = await this.jobService.getJobProgress(jobId);

      const rawProgress = jobEntity.publicProgress as PullLinkedFolderFilesPublicProgress | undefined;

      // PullLinkedFolderFilesPublicProgress has: { totalFiles, folderId, folderName, connector, status }
      const progress = rawProgress
        ? {
            totalFiles: rawProgress.totalFiles,
            folders: [
              {
                id: rawProgress.folderId,
                name: rawProgress.folderName,
                connector: rawProgress.connector,
                files: rawProgress.totalFiles,
                status: rawProgress.status,
              },
            ],
          }
        : undefined;

      return {
        jobId: jobEntity.bullJobId ?? jobId,
        state: jobEntity.state,
        progress,
        failedReason: jobEntity.failedReason ?? undefined,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return { error: `Job ${jobId} not found` };
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { error: errorMessage };
    }
  }
}
