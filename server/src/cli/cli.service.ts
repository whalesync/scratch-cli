import { Injectable } from '@nestjs/common';
import { AuthType, ConnectorAccount } from '@prisma/client';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { DecryptedCredentials } from 'src/remote-service/connector-account/types/encrypted-credentials.interface';
import { ConnectorsService } from 'src/remote-service/connectors/connectors.service';
import { ValidatedConnectorCredentialsDto } from './dtos/credentials.dto';
import { TestCredentialsDto, TestCredentialsResponseDto } from './dtos/test-credentials.dto';

@Injectable()
export class CliService {
  constructor(
    private readonly config: ScratchpadConfigService,
    private readonly connectorsService: ConnectorsService,
  ) {}

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
        id: 'test-connection-temp-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: null,
        organizationId: 'test-org',
        service: service,
        displayName: 'Test Connection',
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
      const connector = await this.connectorsService.getConnector({
        service,
        connectorAccount: inMemoryAccount,
        decryptedCredentials,
      });

      // Test the connection
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
}
