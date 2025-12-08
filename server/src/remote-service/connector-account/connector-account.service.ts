import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { AuthType, ConnectorAccount, Service } from '@prisma/client';
import { ConnectorAccountId, createConnectorAccountId } from '@spinner/shared-types';
import _ from 'lodash';
import { AuditLogService } from 'src/audit/audit-log.service';
import { CredentialEncryptionService } from 'src/credential-encryption/credential-encryption.service';
import { WSLogger } from 'src/logger';
import { OnboardingService } from 'src/users/onboarding.service';
import { canCreateDataSource } from 'src/users/subscription-utils';
import { Actor } from 'src/users/types';
import { DbService } from '../../db/db.service';
import { PostHogEventName, PostHogService } from '../../posthog/posthog.service';
import { EncryptedData } from '../../utils/encryption';
import { Connector } from '../connectors/connector';
import { ConnectorsService } from '../connectors/connectors.service';
import { getServiceDisplayName } from '../connectors/display-names';
import { ConnectorAuthError, exceptionForConnectorError, isUserFriendlyError } from '../connectors/error';
import { TablePreview } from '../connectors/types';
import { ValidatedCreateConnectorAccountDto } from './dto/create-connector-account.dto';
import { UpdateConnectorAccountDto } from './dto/update-connector-account.dto';
import { TableGroup } from './entities/table-list.entity';
import { TestConnectionResponse } from './entities/test-connection.entity';
import { DecryptedCredentials } from './types/encrypted-credentials.interface';

@Injectable()
export class ConnectorAccountService {
  constructor(
    private readonly db: DbService,
    private readonly connectorsService: ConnectorsService,
    private readonly posthogService: PostHogService,
    private readonly auditLogService: AuditLogService,
    private readonly credentialEncryptionService: CredentialEncryptionService,
    private readonly onboardingService: OnboardingService,
  ) {}

  private async getDecryptedAccount(account: ConnectorAccount): Promise<ConnectorAccount & DecryptedCredentials> {
    const decryptedCredentials = await this.credentialEncryptionService.decryptCredentials(
      account.encryptedCredentials as unknown as EncryptedData,
    );
    return {
      ...account,
      ...decryptedCredentials,
    };
  }

  async create(createDto: ValidatedCreateConnectorAccountDto, actor: Actor): Promise<ConnectorAccount> {
    if (!canCreateDataSource(actor.subscriptionStatus, await this.countForType(createDto.service, actor))) {
      throw new ForbiddenException(
        `You have reached the maximum number of ${getServiceDisplayName(createDto.service)} data sources for your subscription`,
      );
    }

    const { credentials: parsedCredentials, extras } = await this.parseUserProvidedParams(
      createDto.userProvidedParams || {},
      createDto.service,
    );

    const credentials: DecryptedCredentials = parsedCredentials;

    const encryptedCredentials = await this.credentialEncryptionService.encryptCredentials(
      credentials as unknown as DecryptedCredentials,
    );

    const connectorAccount = await this.db.client.connectorAccount.create({
      data: {
        id: createConnectorAccountId(),
        userId: actor.userId,
        organizationId: actor.organizationId,
        service: createDto.service,
        displayName: createDto.displayName ?? `${_.startCase(createDto.service.toLowerCase())}`,
        authType: createDto.authType || AuthType.USER_PROVIDED_PARAMS,
        encryptedCredentials: encryptedCredentials as Record<string, any>,
        modifier: createDto.modifier,
        extras,
      },
    });

    const testResult = await this.testConnection(connectorAccount.id, actor);

    this.posthogService.captureEvent(PostHogEventName.CONNECTOR_ACCOUNT_CREATED, actor.userId, {
      service: createDto.service,
      authType: createDto.authType || AuthType.USER_PROVIDED_PARAMS,
      healthStatus: testResult.health,
    });

    await this.auditLogService.logEvent({
      actor,
      eventType: 'create',
      message: `Created new connection ${connectorAccount.displayName}`,
      entityId: connectorAccount.id as ConnectorAccountId,
      context: {
        service: connectorAccount.service,
        authType: connectorAccount.authType,
      },
    });

    // Update onboarding flow if user hasn't completed this step yet
    if (actor.onboarding?.gettingStartedV1?.dataSourceConnected === false) {
      await this.onboardingService.updateOnboardingFlow(actor.userId, 'gettingStartedV1', {
        dataSourceConnected: true,
      });
    }

    return connectorAccount;
  }

  async findAll(actor: Actor): Promise<ConnectorAccount[]> {
    return this.db.client.connectorAccount.findMany({
      where: { organizationId: actor.organizationId },
    });
  }

  async countForType(type: Service, actor: Actor): Promise<number> {
    return this.db.client.connectorAccount.count({
      where: { organizationId: actor.organizationId, service: type },
    });
  }

  async findOne(id: string, actor: Actor): Promise<ConnectorAccount & DecryptedCredentials> {
    const connectorAccount = await this.db.client.connectorAccount.findUnique({
      where: { id, organizationId: actor.organizationId },
    });
    if (!connectorAccount) {
      throw new NotFoundException('ConnectorAccount not found');
    }
    return this.getDecryptedAccount(connectorAccount);
  }

  async update(
    id: string,
    updateDto: UpdateConnectorAccountDto,
    actor: Actor,
  ): Promise<ConnectorAccount & DecryptedCredentials> {
    // Get current account to decrypt existing credentials
    const currentAccount = await this.db.client.connectorAccount.findUnique({
      where: { id, organizationId: actor.organizationId },
    });
    if (!currentAccount) {
      throw new NotFoundException('ConnectorAccount not found');
    }

    const decryptedCredentials = await this.credentialEncryptionService.decryptCredentials(
      currentAccount.encryptedCredentials as unknown as EncryptedData,
    );

    // Update credentials if provided
    const updatedProvidedParams = Object.keys(updateDto.userProvidedParams ?? {}) as (keyof DecryptedCredentials)[];
    for (const param of updatedProvidedParams) {
      decryptedCredentials[param] = updateDto.userProvidedParams?.[param];
    }

    const encryptedCredentials = await this.credentialEncryptionService.encryptCredentials(decryptedCredentials);

    const account = await this.db.client.connectorAccount.update({
      where: { id, organizationId: actor.organizationId },
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
      actor,
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

  async remove(id: string, actor: Actor): Promise<void> {
    const account = await this.findOne(id, actor);
    if (!account) {
      throw new NotFoundException('ConnectorAccount not found');
    }
    await this.db.client.connectorAccount.delete({
      where: { id, organizationId: actor.organizationId },
    });
    this.posthogService.captureEvent(PostHogEventName.CONNECTOR_ACCOUNT_REMOVED, actor.userId, {
      service: account.service,
    });

    await this.auditLogService.logEvent({
      actor,
      eventType: 'delete',
      message: `Deleted connection ${account.displayName}`,
      entityId: account.id as ConnectorAccountId,
    });
  }

  async listAllUserTables(actor: Actor): Promise<TableGroup[]> {
    const allAccounts = await this.db.client.connectorAccount.findMany({
      where: { organizationId: actor.organizationId },
    });

    // Fetch tables from all connector accounts in parallel
    const tablePromises = allAccounts.map((account) =>
      this.listTables(account.service, account.id, actor)
        .then((tables) => ({
          service: account.service,
          connectorAccountId: account.id,
          displayName: account.displayName,
          tables,
        }))
        .catch(() => ({
          // Return empty tables if listTables fails
          service: account.service,
          connectorAccountId: account.id,
          displayName: account.displayName,
          tables: [] as TablePreview[],
        })),
    );

    try {
      const groups = await Promise.all(tablePromises);
      return groups;
    } catch (error) {
      throw new InternalServerErrorException(error instanceof Error ? error.message : String(error), {
        cause: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  async listTables(service: Service, connectorAccountId: string | null, actor: Actor): Promise<TablePreview[]> {
    // When connectorAccountId is null, we're dealing with a service that doesn't require a connector account (e.g., CSV)
    // When connectorAccountId is provided, load the account and pass it to the connector
    let account: (ConnectorAccount & DecryptedCredentials) | null = null;

    if (connectorAccountId !== null) {
      account = await this.findOne(connectorAccountId, actor);
    }

    let connector: Connector<Service, any>;
    try {
      connector = await this.connectorsService.getConnector({
        service,
        connectorAccount: account,
        decryptedCredentials: account,
        userId: actor.userId,
      });
    } catch (error) {
      throw new InternalServerErrorException(error instanceof Error ? error.message : String(error), {
        cause: error instanceof Error ? error : new Error(String(error)),
      });
    }

    try {
      return connector.listTables().then((tables) => tables.sort((a, b) => a.displayName.localeCompare(b.displayName)));
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
    } catch (error) {
      // If the error is already a UserFriendlyError, re-throw it directly
      if (isUserFriendlyError(error)) {
        throw error;
      }
      throw new ConnectorAuthError(
        `Unexpected error in parseUserProvidedParams: ${_.toString(error)}`,
        `There was an unexpected error connecting to ${getServiceDisplayName(service)}`,
        service,
      );
    }
  }

  async testConnection(id: string, actor: Actor): Promise<TestConnectionResponse> {
    const account = await this.findOne(id, actor);
    try {
      const connector = await this.connectorsService.getConnector({
        service: account.service,
        connectorAccount: account,
        decryptedCredentials: account,
      });

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
      WSLogger.debug({
        source: 'ConnectorAccountService',
        message: 'Error testing connection',
        error,
        userId: actor.userId,
        connectorAccountId: id,
      });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.db.client.connectorAccount.update({
        where: { id },
        data: {
          healthStatus: 'FAILED',
          healthStatusLastCheckedAt: new Date(),
          healthStatusMessage: errorMessage,
        },
      });

      return { health: 'error', error: errorMessage };
    }
  }
}
