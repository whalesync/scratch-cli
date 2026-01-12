import { Injectable } from '@nestjs/common';
import { AuthType, ConnectorAccount } from '@prisma/client';
import { createConnectorAccountId, Service } from '@spinner/shared-types';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { DecryptedCredentials } from 'src/remote-service/connector-account/types/encrypted-credentials.interface';
import { Connector } from 'src/remote-service/connectors/connector';
import { ConnectorsService } from 'src/remote-service/connectors/connectors.service';
import { ValidatedConnectorCredentialsDto } from './dtos/credentials.dto';
import { FetchTableSpecDto, FetchTableSpecResponseDto } from './dtos/fetch-table-spec.dto';
import { ListTableSpecsDto, ListTableSpecsResponseDto } from './dtos/list-table-specs.dto';
import { ListTablesDto, ListTablesResponseDto } from './dtos/list-tables.dto';
import { TestCredentialsDto, TestCredentialsResponseDto } from './dtos/test-credentials.dto';

@Injectable()
export class CliService {
  constructor(
    private readonly config: ScratchpadConfigService,
    private readonly connectorsService: ConnectorsService,
  ) {}

  private async getConnectorFromCredentials(
    credentials: ValidatedConnectorCredentialsDto,
  ): Promise<Connector<Service, any>> {
    const service = credentials.service;

    // Parse user-provided params if an auth parser exists for this service
    let parsedCredentials: Record<string, string> = credentials.userProvidedParams ?? {};
    const authParser = this.connectorsService.getAuthParser({ service });
    if (authParser) {
      const result = await authParser.parseUserProvidedParams({
        userProvidedParams: credentials.userProvidedParams ?? {},
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
      authType: credentials.authType ?? AuthType.USER_PROVIDED_PARAMS,
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

  async testCredentials(testCredentialsDto: TestCredentialsDto): Promise<TestCredentialsResponseDto> {
    const credentials = testCredentialsDto.credentials as ValidatedConnectorCredentialsDto;
    if (!credentials?.service) {
      return {
        success: false,
        error: 'Service is required',
      };
    }

    const service = credentials.service;

    try {
      const connector = await this.getConnectorFromCredentials(credentials);
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
   * Lists all the available tables for a connnector
   */
  async listTables(listTablesDto: ListTablesDto): Promise<ListTablesResponseDto> {
    const credentials = listTablesDto.credentials as ValidatedConnectorCredentialsDto;
    if (!credentials?.service) {
      return {
        success: false,
        error: 'Service is required',
      };
    }

    const service = credentials.service;

    try {
      const connector = await this.getConnectorFromCredentials(credentials);
      const tables = await connector.listTables();

      return {
        success: true,
        service,
        tables,
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
   * Retrives a specific table spec from the connector
   */
  async fetchTableSpec(fetchTableSpecDto: FetchTableSpecDto): Promise<FetchTableSpecResponseDto> {
    const credentials = fetchTableSpecDto.credentials as ValidatedConnectorCredentialsDto;
    if (!credentials?.service) {
      return {
        success: false,
        error: 'Service is required',
      };
    }

    if (!fetchTableSpecDto.tableId) {
      return {
        success: false,
        error: 'Table ID is required',
      };
    }

    const service = credentials.service;

    try {
      const connector = await this.getConnectorFromCredentials(credentials);
      const tableSpec = await connector.fetchTableSpec({
        wsId: fetchTableSpecDto.tableId,
        remoteId: [fetchTableSpecDto.tableId],
      });

      return {
        success: true,
        service,
        tableSpec,
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
   * Gets a list of all available tables with full specs from a connection
   */
  async listTableSpecs(listTableSpecsDto: ListTableSpecsDto): Promise<ListTableSpecsResponseDto> {
    const credentials = listTableSpecsDto.credentials as ValidatedConnectorCredentialsDto;
    if (!credentials?.service) {
      return {
        success: false,
        error: 'Service is required',
      };
    }

    const service = credentials.service;

    try {
      const connector = await this.getConnectorFromCredentials(credentials);
      const tables = await connector.listTables();

      const tableSpecs = await Promise.all(tables.map((table) => connector.fetchTableSpec(table.id)));

      return {
        success: true,
        service,
        tables: tableSpecs,
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
}
