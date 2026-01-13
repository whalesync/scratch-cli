import { Injectable } from '@nestjs/common';
import { AuthType, ConnectorAccount } from '@prisma/client';
import { createConnectorAccountId, Service } from '@spinner/shared-types';
import { CliConnectorCredentials } from 'src/auth/types';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WSLogger } from 'src/logger';
import { DecryptedCredentials } from 'src/remote-service/connector-account/types/encrypted-credentials.interface';
import { ConnectorsService } from 'src/remote-service/connectors/connectors.service';
import { ConnectorRecord, TablePreview } from 'src/remote-service/connectors/types';
import { normalizeFileName } from 'src/workbook/util';
import { convertConnectorRecordToFrontMatter } from 'src/workbook/workbook-db';
import { DownloadedFilesResponseDto, DownloadRequestDto, FileContent } from './dtos/download-files.dto';
import { ListTablesResponseDto } from './dtos/list-tables.dto';
import { TestConnectionResponseDto } from './dtos/test-connection.dto';
import { FieldInfo } from './entities/field-info.entity';
import { TableInfo } from './entities/table-info.entity';

@Injectable()
export class CliService {
  constructor(
    private readonly config: ScratchpadConfigService,
    private readonly connectorsService: ConnectorsService,
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
      throw new Error(
        `Invalid service: ${serviceName}. Valid services: ${Object.values(Service).join(', ').toLowerCase()}`,
      );
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

  async testConnection(credentials?: CliConnectorCredentials): Promise<TestConnectionResponseDto> {
    if (!credentials?.service) {
      return {
        success: false,
        error: 'Service is required in X-Scratch-Connector header',
      };
    }

    const service = this.parseServiceName(credentials.service);
    if (!service) {
      return {
        success: false,
        error: `Invalid service: ${credentials.service}. Valid services: ${Object.values(Service).join(', ').toLowerCase()}`,
      };
    }

    try {
      const connector = await this.getConnectorFromCredentials(credentials, service);
      await connector.testConnection();

      return {
        success: true,
        service,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
        service,
      };
    }
  }

  /**
   * Gets a list of all available tables formatted as TableInfo objects
   */
  async listTables(credentials?: CliConnectorCredentials): Promise<ListTablesResponseDto> {
    if (!credentials?.service) {
      return {
        error: 'Service is required in X-Scratch-Connector header',
      };
    }

    const service = this.parseServiceName(credentials.service);
    if (!service) {
      return {
        error: `Invalid service: ${credentials.service}. Valid services: ${Object.values(Service).join(', ').toLowerCase()}`,
      };
    }

    try {
      const connector = await this.getConnectorFromCredentials(credentials, service);
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
          if (tablePreview && tablePreview.metadata && 'siteName' in tablePreview.metadata) {
            tableInfo.siteName = tablePreview.metadata.siteName as string;
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

      return {
        tables,
      };
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
    credentials: CliConnectorCredentials | undefined,
    downloadRequest: DownloadRequestDto,
  ): Promise<DownloadedFilesResponseDto> {
    if (!credentials?.service) {
      return {
        error: 'Service is required in X-Scratch-Connector header',
      };
    }

    if (!downloadRequest.tableId || downloadRequest.tableId.length === 0) {
      return {
        error: 'Table ID is required',
      };
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
        const { content } = convertConnectorRecordToFrontMatter(record, contentColumnId);

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

      return {
        files,
      };
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
}
