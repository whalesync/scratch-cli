import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthType, ConnectorAccount } from '@prisma/client';
import { createConnectorAccountId, Service, SnapshotRecordId, WorkbookId } from '@spinner/shared-types';
import { CliConnectorCredentials } from 'src/auth/types';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WSLogger } from 'src/logger';
import { PostHogEventName, PostHogService } from 'src/posthog/posthog.service';
import { DecryptedCredentials } from 'src/remote-service/connector-account/types/encrypted-credentials.interface';
import { ConnectorsService } from 'src/remote-service/connectors/connectors.service';
import { ConnectorFile, TablePreview } from 'src/remote-service/connectors/types';
import { Actor } from 'src/users/types';
import { DataFolderService } from 'src/workbook/data-folder.service';
import { DataFolderEntity } from 'src/workbook/entities/data-folder.entity';
import { Workbook } from 'src/workbook/entities/workbook.entity';
import { normalizeFileName } from 'src/workbook/util';
import { WorkbookService } from 'src/workbook/workbook.service';
import { DownloadedFilesResponseDto, DownloadRequestDto, FileContent } from './dtos/download-files.dto';
import { ListTablesResponseDto, TableInfo } from './dtos/list-tables.dto';
import { TestConnectionResponseDto } from './dtos/test-connection.dto';
import { UploadChangesDto, UploadChangesResponseDto, UploadChangesResult } from './dtos/upload-changes.dto';
import { ValidatedFileResult, ValidateFilesRequestDto, ValidateFilesResponseDto } from './dtos/validate-files.dto';

@Injectable()
export class CliService {
  constructor(
    private readonly config: ScratchpadConfigService,
    private readonly connectorsService: ConnectorsService,
    private readonly posthogService: PostHogService,
    private readonly workbookService: WorkbookService,
    private readonly dataFolderService: DataFolderService,
  ) {}

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

  async testConnection(credentials: CliConnectorCredentials, actor?: Actor): Promise<TestConnectionResponseDto> {
    try {
      const connector = await this.getConnectorFromCredentials(credentials, credentials.service);
      await connector.testConnection();

      const result = {
        success: true,
        service: credentials.service,
      };

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const result = {
        success: false,
        error: errorMessage,
        service: credentials.service,
      };

      return result;
    } finally {
      if (actor) {
        this.posthogService.captureEvent(PostHogEventName.CLI_TEST_CONNECTION, actor.userId, {
          service: credentials.service,
        });
      }
    }
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

  async download(
    credentials: CliConnectorCredentials,
    downloadRequest: DownloadRequestDto,
    actor?: Actor,
  ): Promise<DownloadedFilesResponseDto> {
    if (!downloadRequest.tableId || downloadRequest.tableId.length === 0) {
      throw new BadRequestException('Table ID is missing from request');
    }

    try {
      const connector = await this.getConnectorFromCredentials(credentials, credentials.service);

      // Check if the connector supports JSON-based download
      if (!connector.downloadRecordFiles) {
        return {
          error: `The ${credentials.service} connector does not support JSON file downloads`,
        };
      }

      // Fetch the JSON table spec
      const tableSpec = await connector.fetchJsonTableSpec({
        wsId: downloadRequest.tableId.join('-'),
        remoteId: downloadRequest.tableId,
      });

      // Collect all files using the JSON-based method
      const allFiles: ConnectorFile[] = [];

      await connector.downloadRecordFiles(
        tableSpec,
        ({ files }) => {
          allFiles.push(...files);
          return Promise.resolve();
        },
        {}, // Empty progress object for CLI usage
      );

      // Determine the ID field from the table spec (e.g., 'uid' for Audienceful, 'id' for others)
      const idField = tableSpec.idColumnRemoteId || 'id';
      // Determine the filename field from request or use the ID field
      const filenameField = downloadRequest.filenameFieldId || idField;

      // Convert to response format
      const files: FileContent[] = allFiles.map((file) => {
        // Get the ID from the file using the schema-defined ID field
        const rawId = file[idField];
        const id = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : '';

        // Get filename from the specified field or fall back to ID
        let fileName = id;
        if (filenameField && file[filenameField]) {
          const fieldValue = file[filenameField];
          if (typeof fieldValue === 'string') {
            fileName = fieldValue;
          } else if (typeof fieldValue === 'number') {
            fileName = String(fieldValue);
          }
        }

        return {
          slug: normalizeFileName(fileName),
          id,
          content: JSON.stringify(file, null, 2),
        };
      });

      const result = {
        files,
      };

      if (actor) {
        this.posthogService.captureEvent(PostHogEventName.CLI_DOWNLOAD, actor.userId, {
          service: credentials.service,
          fileCount: result.files?.length || 0,
          tableCount: downloadRequest.tableId?.length || 0,
        });
      }

      return result;
    } catch (error: unknown) {
      WSLogger.error({
        source: 'CliService',
        message: 'Error downloading files',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        error: errorMessage,
      };
    }
  }

  async upload(
    credentials: CliConnectorCredentials,
    uploadChanges: UploadChangesDto,
    actor?: Actor,
  ): Promise<UploadChangesResponseDto> {
    WSLogger.info({
      source: 'CliService',
      message: 'Uploading changes',
      changes: uploadChanges,
    });

    if (!uploadChanges.tableId || uploadChanges.tableId.length === 0) {
      throw new BadRequestException('Table ID is missing from request');
    }

    if (!uploadChanges.creates && !uploadChanges.updates && !uploadChanges.deletes) {
      throw new BadRequestException('No changes provided in request');
    }

    const results: UploadChangesResult[] = [];

    try {
      const connector = await this.getConnectorFromCredentials(credentials, credentials.service);

      // Fetch the table spec using the tableId array as the remoteId
      const tableSpec = await connector.fetchTableSpec({
        wsId: uploadChanges.tableId.join('-'),
        remoteId: uploadChanges.tableId,
      });

      // NOTE: this is super inefficient to do each push one at a time, they should be batched together but this
      // does provide better output while we develop the CLI

      // Process creates one at a time
      if (uploadChanges.creates && uploadChanges.creates.length > 0) {
        for (const create of uploadChanges.creates) {
          try {
            const fields = this.convertOperationDataToFields(create.data ?? {});
            const returnedRecords = await connector.createRecords(tableSpec, {}, [{ wsId: create.filename, fields }]);
            const returnedRecord = returnedRecords[0];
            results.push({
              op: 'create',
              id: returnedRecord?.remoteId ?? '',
              filename: create.filename,
            });
          } catch (error: unknown) {
            results.push({
              op: 'create',
              id: '',
              filename: create.filename,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      // Process updates one at a time
      if (uploadChanges.updates && uploadChanges.updates.length > 0) {
        for (const update of uploadChanges.updates) {
          try {
            const fields = this.convertOperationDataToFields(update.data ?? {});
            await connector.updateRecords(tableSpec, {}, [
              {
                id: { wsId: update.filename as SnapshotRecordId, remoteId: update.id },
                partialFields: fields,
              },
            ]);
            results.push({
              op: 'update',
              id: update.id,
              filename: update.filename,
            });
          } catch (error: unknown) {
            results.push({
              op: 'update',
              id: update.id,
              filename: update.filename,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      // Process deletes one at a time
      if (uploadChanges.deletes && uploadChanges.deletes.length > 0) {
        for (const deleteOp of uploadChanges.deletes) {
          try {
            await connector.deleteRecords(tableSpec, [{ wsId: deleteOp.filename, remoteId: deleteOp.id }]);
            results.push({
              op: 'delete',
              id: deleteOp.id,
              filename: deleteOp.filename,
            });
          } catch (error: unknown) {
            results.push({
              op: 'delete',
              id: deleteOp.id,
              filename: deleteOp.filename,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      const result = { results };

      if (actor) {
        const operationCount =
          (uploadChanges.creates?.length || 0) +
          (uploadChanges.updates?.length || 0) +
          (uploadChanges.deletes?.length || 0);
        this.posthogService.captureEvent(PostHogEventName.CLI_UPLOAD, actor.userId, {
          service: credentials.service,
          operationCount,
          createCount: uploadChanges.creates?.length || 0,
          updateCount: uploadChanges.updates?.length || 0,
          deleteCount: uploadChanges.deletes?.length || 0,
        });
      }

      return result;
    } catch (error: unknown) {
      WSLogger.error({
        source: 'CliService',
        message: 'Error uploading changes',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async validateFiles(
    credentials: CliConnectorCredentials,
    validateRequest: ValidateFilesRequestDto,
    actor?: Actor,
  ): Promise<ValidateFilesResponseDto> {
    if (!validateRequest.tableId || validateRequest.tableId.length === 0) {
      throw new BadRequestException('Table ID is missing from request');
    }

    if (!validateRequest.files || validateRequest.files.length === 0) {
      throw new BadRequestException('No files provided for validation');
    }

    try {
      const connector = await this.getConnectorFromCredentials(credentials, credentials.service);

      // Fetch the table spec using the tableId array as the remoteId
      const tableSpec = await connector.fetchTableSpec({
        wsId: validateRequest.tableId.join('-'),
        remoteId: validateRequest.tableId,
      });

      // Check if the connector supports file validation
      if (!connector.validateFiles) {
        // If the connector doesn't support validation, return all files as publishable
        const files: ValidatedFileResult[] = validateRequest.files.map((file) => ({
          filename: file.filename ?? '',
          id: file.id,
          data: file.data ?? {},
          publishable: true,
        }));

        return { files };
      }

      // Prepare files for validation
      const filesToValidate = validateRequest.files.map((file) => ({
        filename: file.filename ?? '',
        id: file.id,
        data: file.data ?? {},
      }));

      // Call the connector's validateFiles method
      const validationResults = await connector.validateFiles(tableSpec, filesToValidate);

      const result = {
        files: validationResults,
      };

      if (actor) {
        this.posthogService.captureEvent(PostHogEventName.CLI_VALIDATE_FILES, actor.userId, {
          service: credentials.service,
          fileCount: validateRequest.files.length,
          publishableCount: validationResults.filter((f) => f.publishable).length,
        });
      }

      return result;
    } catch (error: unknown) {
      WSLogger.error({
        source: 'CliService',
        message: 'Error validating files',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        error: errorMessage,
      };
    }
  }

  /**
   * Converts operation data (key-value pairs) to connector record fields.
   * The data comes directly from the CLI as parsed frontmatter fields.
   * Removes the 'remoteId' property which is metadata, not a field value.
   */
  private convertOperationDataToFields(data: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'remoteId'));
  }
}
