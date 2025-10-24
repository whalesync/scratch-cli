import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { AuthType, ConnectorAccount, Service } from '@prisma/client';
import _ from 'lodash';
import { AuditLogService } from 'src/audit/audit-log.service';
import { DbService } from '../../db/db.service';
import { PostHogEventName, PostHogService } from '../../posthog/posthog.service';
import { ConnectorAccountId, createConnectorAccountId } from '../../types/ids';
import { EncryptedData, getEncryptionService } from '../../utils/encryption';
import { Connector } from '../connectors/connector';
import { ConnectorsService } from '../connectors/connectors.service';
import { exceptionForConnectorError } from '../connectors/error';
import { TablePreview } from '../connectors/types';
import { CreateConnectorAccountDto } from './dto/create-connector-account.dto';
import { UpdateConnectorAccountDto } from './dto/update-connector-account.dto';
import { TestConnectionResponse } from './entities/test-connection.entity';
import { DecryptedCredentials } from './types/encrypted-credentials.interface';

@Injectable()
export class ConnectorAccountService {
  constructor(
    private readonly db: DbService,
    private readonly connectorsService: ConnectorsService,
    private readonly posthogService: PostHogService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async encryptCredentials(credentials: DecryptedCredentials): Promise<EncryptedData> {
    const encryptionService = getEncryptionService();
    const encryptedData = await encryptionService.encryptObject(credentials);
    return encryptedData;
  }

  private async decryptCredentials(encryptedCredentials: EncryptedData): Promise<DecryptedCredentials> {
    if (!encryptedCredentials || Object.keys(encryptedCredentials).length === 0) {
      return {};
    }

    const encryptionService = getEncryptionService();
    const decrypted = await encryptionService.decryptObject<DecryptedCredentials>(encryptedCredentials);

    // Convert oauthExpiresAt back to Date if it exists
    if (decrypted.oauthExpiresAt) {
      decrypted.oauthExpiresAt = new Date(decrypted.oauthExpiresAt);
    }

    return decrypted;
  }

  private async getDecryptedAccount(account: ConnectorAccount): Promise<ConnectorAccount & DecryptedCredentials> {
    const decryptedCredentials = await this.decryptCredentials(
      account.encryptedCredentials as unknown as EncryptedData,
    );
    return {
      ...account,
      ...decryptedCredentials,
    };
  }

  async create(createDto: CreateConnectorAccountDto, userId: string): Promise<ConnectorAccount> {
    const { credentials: parsedCredentials, extras } = await this.parseUserProvidedParams(
      createDto.userProvidedParams || {},
      createDto.service,
    );

    const credentials: DecryptedCredentials = parsedCredentials;

    const encryptedCredentials = await this.encryptCredentials(credentials as unknown as DecryptedCredentials);

    const connectorAccount = await this.db.client.connectorAccount.create({
      data: {
        id: createConnectorAccountId(),
        userId,
        service: createDto.service,
        displayName: createDto.displayName ?? `${_.startCase(createDto.service.toLowerCase())}`,
        authType: createDto.authType || AuthType.USER_PROVIDED_PARAMS,
        encryptedCredentials: encryptedCredentials as Record<string, any>,
        modifier: createDto.modifier,
        extras,
      },
    });

    const testResult = await this.testConnection(connectorAccount.id, userId);

    this.posthogService.captureEvent(PostHogEventName.CONNECTOR_ACCOUNT_CREATED, userId, {
      service: createDto.service,
      authType: createDto.authType || AuthType.USER_PROVIDED_PARAMS,
      healthStatus: testResult.health,
    });

    await this.auditLogService.logEvent({
      userId,
      eventType: 'create',
      message: `Created new connection ${connectorAccount.displayName}`,
      entityId: connectorAccount.id as ConnectorAccountId,
      context: {
        service: connectorAccount.service,
        authType: connectorAccount.authType,
      },
    });

    return connectorAccount;
  }

  async findAll(userId: string): Promise<ConnectorAccount[]> {
    return this.db.client.connectorAccount.findMany({
      where: { userId },
    });
  }

  async findOne(id: string, userId: string): Promise<ConnectorAccount & DecryptedCredentials> {
    const connectorAccount = await this.db.client.connectorAccount.findUnique({
      where: { id, userId },
    });
    if (!connectorAccount) {
      throw new NotFoundException('ConnectorAccount not found');
    }
    return this.getDecryptedAccount(connectorAccount);
  }

  async update(
    id: string,
    updateDto: UpdateConnectorAccountDto,
    userId: string,
  ): Promise<ConnectorAccount & DecryptedCredentials> {
    // Get current account to decrypt existing credentials
    const currentAccount = await this.db.client.connectorAccount.findUnique({
      where: { id, userId },
    });
    if (!currentAccount) {
      throw new NotFoundException('ConnectorAccount not found');
    }

    const decryptedCredentials = await this.decryptCredentials(
      currentAccount.encryptedCredentials as unknown as EncryptedData,
    );

    // Update credentials if provided
    const updatedProvidedParams = Object.keys(updateDto.userProvidedParams ?? {});
    for (const param of updatedProvidedParams) {
      decryptedCredentials[param] = updateDto.userProvidedParams?.[param];
    }

    const encryptedCredentials = await this.encryptCredentials(decryptedCredentials);

    const account = await this.db.client.connectorAccount.update({
      where: { id, userId },
      data: {
        displayName: updateDto.displayName,
        encryptedCredentials: encryptedCredentials as Record<string, any>,
        modifier: updateDto.modifier,
        extras: updateDto.extras,
        healthStatus: null,
        healthStatusLastCheckedAt: null,
      },
    });

    await this.auditLogService.logEvent({
      userId,
      eventType: 'update',
      message: `Updated connection ${account.displayName}`,
      entityId: account.id as ConnectorAccountId,
      context: {
        service: account.service,
        authType: account.authType,
        changedFields: Object.keys(updateDto),
      },
    });

    return this.getDecryptedAccount(account);
  }

  async remove(id: string, userId: string): Promise<void> {
    const account = await this.findOne(id, userId);
    if (!account) {
      throw new NotFoundException('ConnectorAccount not found');
    }
    await this.db.client.connectorAccount.delete({
      where: { id, userId },
    });
    this.posthogService.captureEvent(PostHogEventName.CONNECTOR_ACCOUNT_REMOVED, userId, {
      service: account.service,
    });

    await this.auditLogService.logEvent({
      userId,
      eventType: 'delete',
      message: `Deleted connection ${account.displayName}`,
      entityId: account.id as ConnectorAccountId,
    });
  }

  async listTables(service: Service, connectorAccountId: string | null, userId: string): Promise<TablePreview[]> {
    // When connectorAccountId is null, we're dealing with a service that doesn't require a connector account (e.g., CSV)
    // When connectorAccountId is provided, load the account and pass it to the connector
    let account: (ConnectorAccount & DecryptedCredentials) | null = null;

    if (connectorAccountId !== null) {
      account = await this.findOne(connectorAccountId, userId);
    }

    let connector: Connector<Service, any>;
    try {
      connector = await this.connectorsService.getConnector({
        service,
        connectorAccount: account,
        decryptedCredentials: account,
        userId,
      });
    } catch (error) {
      throw new InternalServerErrorException(error instanceof Error ? error.message : String(error), {
        cause: error instanceof Error ? error : new Error(String(error)),
      });
    }

    try {
      return connector.listTables();
    } catch (error) {
      throw exceptionForConnectorError(error, connector);
    }
  }

  async parseUserProvidedParams(
    userProvidedParams: Record<string, string>,
    service: Service,
  ): Promise<{ credentials: Record<string, string>; extras: Record<string, string> }> {
    const authParser = this.connectorsService.getAuthParser({
      service,
    });
    if (!authParser) {
      return { credentials: userProvidedParams, extras: {} };
    }
    try {
      const result = await authParser.parseUserProvidedParams({ userProvidedParams });
      return { ...result };
    } catch (error: unknown) {
      throw new InternalServerErrorException('Failed to parse user provided parameters', {
        cause: error as Error,
      });
    }
  }

  async testConnection(id: string, userId: string): Promise<TestConnectionResponse> {
    const account = await this.findOne(id, userId);
    const connector = await this.connectorsService.getConnector({
      service: account.service,
      connectorAccount: account,
      decryptedCredentials: account,
    });
    try {
      await connector.testConnection();

      await this.db.client.connectorAccount.update({
        where: { id },
        data: {
          healthStatus: 'OK',
          healthStatusLastCheckedAt: new Date(),
        },
      });

      return { health: 'ok' };
    } catch (error: unknown) {
      await this.db.client.connectorAccount.update({
        where: { id },
        data: {
          healthStatus: 'FAILED',
          healthStatusLastCheckedAt: new Date(),
        },
      });

      if (error instanceof Error) {
        return { health: 'error', error: error.message };
      }
      return { health: 'error', error: 'Unknown error' };
    }
  }
}
