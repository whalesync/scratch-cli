import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthType, ConnectorAccount } from '@prisma/client';
import { createConnectorAccountId, Service, SnapshotRecordId } from '@spinner/shared-types';
import { CliConnectorCredentials } from 'src/auth/types';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WSLogger } from 'src/logger';
import { PostHogEventName, PostHogService } from 'src/posthog/posthog.service';
import { DecryptedCredentials } from 'src/remote-service/connector-account/types/encrypted-credentials.interface';
import { ConnectorsService } from 'src/remote-service/connectors/connectors.service';
import { BaseColumnSpec, ConnectorRecord, TablePreview } from 'src/remote-service/connectors/types';
import { Actor } from 'src/users/types';
import { normalizeFileName } from 'src/workbook/util';
import { convertConnectorRecordToFrontMatter } from 'src/workbook/workbook-db';
import { DownloadedFilesResponseDto, DownloadRequestDto, FileContent } from './dtos/download-files.dto';
import { JsonTableInfo, ListJsonTablesResponseDto } from './dtos/list-json-tables.dto';
import { ListTablesResponseDto } from './dtos/list-tables.dto';
import { TestConnectionResponseDto } from './dtos/test-connection.dto';
import { UploadChangesDto, UploadChangesResponseDto, UploadChangesResult } from './dtos/upload-changes.dto';
import { ValidatedFileResult, ValidateFilesRequestDto, ValidateFilesResponseDto } from './dtos/validate-files.dto';
import { FieldInfo } from './entities/field-info.entity';
import { TableInfo } from './entities/table-info.entity';

@Injectable()
export class CliService {
  constructor(
    private readonly config: ScratchpadConfigService,
    private readonly connectorsService: ConnectorsService,
    private readonly posthogService: PostHogService,
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
   * Gets a list of all available tables formatted as TableInfo objects
   */
  async listTables(credentials: CliConnectorCredentials, actor?: Actor): Promise<ListTablesResponseDto> {
    try {
      const connector = await this.getConnectorFromCredentials(credentials, credentials.service);
      const tablePreviews = await connector.listTables();

      const tableSpecs = await Promise.all(
        tablePreviews.map((table: TablePreview) => connector.fetchTableSpec(table.id)),
      );

      // Convert table specs to TableInfo objects
      const tables: TableInfo[] = tableSpecs.map((spec) => {
        const tableInfo = new TableInfo();
        const tablePreview = tablePreviews.find((p) => spec.id.wsId === p.id.wsId);
        if (spec.id.remoteId.length > 1) {
          // Table IDs are an array that represent a path to an object.
          // If there are multiple elements, the first element is a base or site ID, the second element is the table ID
          tableInfo.siteId = spec.id.remoteId[0];
          tableInfo.id = spec.id.remoteId[1];

          // The site name, might be stored in the TablePreview metadata
          if (tablePreview && tablePreview.metadata) {
            if ('siteName' in tablePreview.metadata) {
              tableInfo.siteName = tablePreview.metadata.siteName as string;
            } else if ('baseName' in tablePreview.metadata) {
              tableInfo.siteName = tablePreview.metadata.baseName as string;
            }
          }
        } else {
          tableInfo.id = spec.id.remoteId[0];
        }
        tableInfo.name = spec.name;
        tableInfo.slug = spec.slug;

        // Convert columns to FieldInfo objects
        tableInfo.fields = spec.columns
          .filter((col) => !col.readonly)
          .map((col) => {
            const fieldInfo = new FieldInfo();
            fieldInfo.id = col.id.remoteId.join('/');
            fieldInfo.name = col.name;
            fieldInfo.slug = col.slug ?? col.id.remoteId[0];
            fieldInfo.type = col.pgType;
            fieldInfo.required = col.required;
            fieldInfo.extraInfo = this.extractExtraInfo(col);
            return fieldInfo;
          });

        tableInfo.systemFields = spec.columns
          .filter((col) => col.readonly)
          .map((col) => {
            const fieldInfo = new FieldInfo();
            fieldInfo.id = Array.isArray(col.id.remoteId) ? col.id.remoteId.join('/') : col.id.remoteId;
            fieldInfo.name = col.name;
            fieldInfo.slug = col.slug ?? col.id.remoteId[0];
            fieldInfo.type = col.pgType;
            fieldInfo.required = col.required;
            fieldInfo.extraInfo = this.extractExtraInfo(col);
            return fieldInfo;
          });

        tableInfo.extraInfo = {};
        if (spec.mainContentColumnRemoteId) {
          tableInfo.extraInfo.contentFieldId = spec.mainContentColumnRemoteId[0];
        }
        if (spec.titleColumnRemoteId && spec.titleColumnRemoteId.length > 0) {
          tableInfo.extraInfo.filenameFieldId = spec.titleColumnRemoteId[0];
        }

        return tableInfo;
      });

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
   * Gets a list of all available tables with their JSON Schema specs
   */
  async listJsonTables(credentials: CliConnectorCredentials, actor?: Actor): Promise<ListJsonTablesResponseDto> {
    try {
      const connector = await this.getConnectorFromCredentials(credentials, credentials.service);

      // Check if the connector supports fetchJsonTableSpec
      if (!connector.fetchJsonTableSpec) {
        return {
          error: `The ${credentials.service} connector does not support JSON Schema specs`,
        };
      }

      const tablePreviews = await connector.listTables();

      const tables: JsonTableInfo[] = await Promise.all(
        tablePreviews.map(async (table: TablePreview) => {
          const jsonTableInfo = new JsonTableInfo();

          if (table.id.remoteId.length > 1) {
            jsonTableInfo.siteId = table.id.remoteId[0];
            jsonTableInfo.id = table.id.remoteId[1];
          } else {
            jsonTableInfo.id = table.id.remoteId[0];
          }

          jsonTableInfo.name = table.displayName;
          const jsonSpec = await connector.fetchJsonTableSpec(table.id);
          jsonTableInfo.schema = jsonSpec.schema;

          return jsonTableInfo;
        }),
      );

      const result = {
        tables,
      };

      if (actor) {
        this.posthogService.captureEvent(PostHogEventName.CLI_LIST_TABLES, actor.userId, {
          service: credentials.service,
          tableCount: result.tables?.length || 0,
          jsonSchema: true,
        });
      }

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      WSLogger.error({
        source: 'CliService',
        message: 'Error listing JSON tables',
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

      // Fetch the table spec using the tableId array as the remoteId
      // TODO: the client should probably just provide the spec directly
      const tableSpec = await connector.fetchTableSpec({
        wsId: downloadRequest.tableId.join('-'),
        remoteId: downloadRequest.tableId,
      });

      // Collect all records
      const allRecords: ConnectorRecord[] = [];

      // download all the tables in one go
      // TODO: add pagination support to the connectors
      await connector.downloadTableRecords(
        tableSpec,
        {}, // Empty column settings map for CLI usage
        ({ records }) => {
          allRecords.push(...records);
          return Promise.resolve();
        },
        {}, // Empty progress object for CLI usage
      );

      const fileNameColumnId = downloadRequest.filenameFieldId
        ? [downloadRequest.filenameFieldId]
        : tableSpec.titleColumnRemoteId;
      const contentColumnId = downloadRequest.contentFieldId
        ? [downloadRequest.contentFieldId]
        : tableSpec.mainContentColumnRemoteId;

      // Convert records to frontmatter files
      const files: FileContent[] = allRecords.map((record) => {
        const { content } = convertConnectorRecordToFrontMatter(record, { contentColumnId, embedRemoteId: true });

        // Determine filename from title column or record ID
        let fileName = record.id;
        if (fileNameColumnId) {
          const column = tableSpec.columns.find((c) =>
            Array.isArray(c.id.remoteId)
              ? c.id.remoteId[0] === fileNameColumnId?.[0]
              : c.id.remoteId === fileNameColumnId?.[0],
          );
          const titleValue = record.fields[column?.id.wsId ?? ''];
          if (titleValue && typeof titleValue === 'string') {
            fileName = titleValue;
          }
        }

        return {
          slug: normalizeFileName(fileName),
          id: record.id,
          content,
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

  private extractExtraInfo(col: BaseColumnSpec): Record<string, string> {
    const extraInfo: Record<string, string> = {};
    if (col.metadata?.attachments) {
      extraInfo.attachments = col.metadata.attachments;
    }
    return extraInfo;
  }
}
