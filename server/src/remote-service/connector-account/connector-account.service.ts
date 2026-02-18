import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AuthType, ConnectorAccount } from '@prisma/client';
import {
  ConnectorAccountId,
  createConnectorAccountId,
  Service,
  TableDiscoveryMode,
  UpdateConnectorAccountDto,
  ValidatedCreateConnectorAccountDto,
  WorkbookId,
} from '@spinner/shared-types';
import { randomUUID } from 'crypto';
import _ from 'lodash';
import { AuditLogService } from 'src/audit/audit-log.service';
import { CredentialEncryptionService } from 'src/credential-encryption/credential-encryption.service';
import { WSLogger } from 'src/logger';
import { OAuthService } from 'src/oauth/oauth.service';
import { canCreateDataSource } from 'src/users/subscription-utils';
import { Actor } from 'src/users/types';
import { DbService } from '../../db/db.service';
import { PostHogService } from '../../posthog/posthog.service';
import { EncryptedData } from '../../utils/encryption';
import { Connector } from '../connectors/connector';
import { ConnectorsService } from '../connectors/connectors.service';
import { getServiceDisplayName } from '../connectors/display-names';
import { ConnectorAuthError, exceptionForConnectorError, isUserFriendlyError } from '../connectors/error';
import { KnexPGClient } from '../connectors/library/pg-common';
import {
  buildConnectionString,
  buildCreateUserSQL,
  SupabaseApiClient,
  SupabaseProject,
} from '../connectors/library/supabase';
import { TablePreview } from '../connectors/types';
import { TableSearchResult } from './entities/table-list.entity';
import { TestConnectionResponse } from './entities/test-connection.entity';
import { DecryptedCredentials } from './types/encrypted-credentials.interface';

@Injectable()
export class ConnectorAccountService {
  constructor(
    private readonly db: DbService,
    private readonly connectorsService: ConnectorsService,
    private readonly oauthService: OAuthService,
    private readonly posthogService: PostHogService,
    private readonly auditLogService: AuditLogService,
    private readonly credentialEncryptionService: CredentialEncryptionService,
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

  async create(
    workbookId: WorkbookId,
    createDto: ValidatedCreateConnectorAccountDto,
    actor: Actor,
  ): Promise<ConnectorAccount> {
    // Verify workbook access
    const workbook = await this.db.client.workbook.findFirst({
      where: { id: workbookId, organizationId: actor.organizationId },
    });
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    if (!canCreateDataSource(actor.subscriptionStatus, await this.countForType(createDto.service, workbookId, actor))) {
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
        workbookId: workbookId,
        service: createDto.service,
        displayName: createDto.displayName ?? `${_.startCase(createDto.service.toLowerCase())}`,
        authType: createDto.authType || AuthType.USER_PROVIDED_PARAMS,
        encryptedCredentials: encryptedCredentials as Record<string, any>,
        modifier: createDto.modifier,
        extras,
      },
    });

    const testResult = await this.testConnection(workbookId, connectorAccount.id, actor);

    this.posthogService.trackCreateDataSource(actor, connectorAccount, {
      authType: createDto.authType ?? connectorAccount.authType,
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

    return connectorAccount;
  }

  async findAll(workbookId: WorkbookId, actor: Actor): Promise<ConnectorAccount[]> {
    // Workbook ownership verified in controller; workbookId provides scoping
    void actor;
    return this.db.client.connectorAccount.findMany({
      where: { workbookId },
    });
  }

  /**
   * Find all connector accounts for an organization (admin purposes).
   * Queries through workbook relation since ConnectorAccount no longer has organizationId.
   */
  async findAllForOrganization(actor: Actor): Promise<ConnectorAccount[]> {
    return this.db.client.connectorAccount.findMany({
      where: { workbook: { organizationId: actor.organizationId } },
    });
  }

  async countForType(type: Service, workbookId: WorkbookId, actor: Actor): Promise<number> {
    // Workbook ownership verified in controller; workbookId provides scoping
    void actor;
    return this.db.client.connectorAccount.count({
      where: { workbookId, service: type },
    });
  }

  async findOne(workbookId: WorkbookId, id: string, actor: Actor): Promise<ConnectorAccount & DecryptedCredentials> {
    // Workbook ownership verified in controller; workbookId provides scoping
    void actor;
    const connectorAccount = await this.db.client.connectorAccount.findUnique({
      where: { id, workbookId },
    });
    if (!connectorAccount) {
      throw new NotFoundException('ConnectorAccount not found');
    }
    return this.getDecryptedAccount(connectorAccount);
  }

  /**
   * Find a connector account by ID only, without workbook context.
   * Used for internal operations like OAuth callback where we need to look up an account.
   * Organization check is done via the workbook relation.
   */
  async findOneById(id: string, actor: Actor): Promise<ConnectorAccount & DecryptedCredentials> {
    const connectorAccount = await this.db.client.connectorAccount.findFirst({
      where: { id, workbook: { organizationId: actor.organizationId } },
    });
    if (!connectorAccount) {
      throw new NotFoundException('ConnectorAccount not found');
    }
    return this.getDecryptedAccount(connectorAccount);
  }

  async update(
    workbookId: WorkbookId,
    id: string,
    updateDto: UpdateConnectorAccountDto,
    actor: Actor,
  ): Promise<ConnectorAccount & DecryptedCredentials> {
    // Workbook ownership verified in controller; workbookId provides scoping
    void actor;

    // Get current account to decrypt existing credentials
    const currentAccount = await this.db.client.connectorAccount.findUnique({
      where: { id, workbookId },
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
      where: { id, workbookId },
      data: {
        displayName: updateDto.displayName,
        encryptedCredentials: encryptedCredentials as Record<string, any>,
        modifier: updateDto.modifier,
        extras: updateDto.extras,
        healthStatus: null,
        healthStatusLastCheckedAt: null,
      },
    });

    this.posthogService.trackUpdateDataSource(actor, account, {
      changedFields: Object.keys(updateDto),
    });

    await this.auditLogService.logEvent({
      actor,
      eventType: 'update',
      message: `Updated connection ${account.displayName}`,
      entityId: account.id as ConnectorAccountId,
      context: {
        service: account.service as Service,
        authType: account.authType,
        changedFields: Object.keys(updateDto),
      },
    });

    return this.getDecryptedAccount(account);
  }

  async remove(workbookId: WorkbookId, id: string, actor: Actor): Promise<void> {
    const account = await this.findOne(workbookId, id, actor);
    if (!account) {
      throw new NotFoundException('ConnectorAccount not found');
    }
    await this.db.client.connectorAccount.delete({
      where: { id, workbookId },
    });
    this.posthogService.trackRemoveDataSource(actor, account);

    await this.auditLogService.logEvent({
      actor,
      eventType: 'delete',
      message: `Deleted connection ${account.displayName}`,
      entityId: account.id as ConnectorAccountId,
    });
  }

  async listTables(
    connectorAccountId: string,
    actor: Actor,
  ): Promise<{ tables: TablePreview[]; discoveryMode: TableDiscoveryMode }> {
    const account = await this.findOneById(connectorAccountId, actor);

    let connector: Connector<Service, any>;
    try {
      connector = await this.connectorsService.getConnector({
        service: account.service as Service,
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
      const tables = await connector
        .listTables()
        .then((tables) => tables.sort((a, b) => a.displayName.localeCompare(b.displayName)));
      return { tables, discoveryMode: connector.tableDiscoveryMode };
    } catch (error) {
      throw exceptionForConnectorError(error, connector);
    }
  }

  async searchTables(connectorAccountId: string, searchTerm: string, actor: Actor): Promise<TableSearchResult> {
    const account = await this.findOneById(connectorAccountId, actor);

    let connector: Connector<Service, any>;
    try {
      connector = await this.connectorsService.getConnector({
        service: account.service as Service,
        connectorAccount: account,
        decryptedCredentials: account,
        userId: actor.userId,
      });
    } catch (error) {
      throw new InternalServerErrorException(error instanceof Error ? error.message : String(error), {
        cause: error instanceof Error ? error : new Error(String(error)),
      });
    }

    if (connector.tableDiscoveryMode !== TableDiscoveryMode.SEARCH) {
      throw new BadRequestException('This connector does not support table search');
    }

    if (!searchTerm?.trim()) {
      return { tables: [], hasMore: false };
    }

    try {
      return await connector.searchTables(searchTerm);
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

  // ---------------------------------------------------------------------------
  // Supabase setup
  // ---------------------------------------------------------------------------

  /**
   * List Supabase projects accessible via the connector account's OAuth token.
   * Filters to ACTIVE_HEALTHY projects only.
   */
  async listSupabaseProjects(connectorAccountId: string, actor: Actor): Promise<SupabaseProject[]> {
    const account = await this.findOneById(connectorAccountId, actor);
    if ((account.service as Service) !== Service.SUPABASE) {
      throw new BadRequestException('This endpoint is only available for Supabase connections');
    }

    const accessToken = await this.oauthService.getValidAccessToken(connectorAccountId);
    const apiClient = new SupabaseApiClient(accessToken);
    const projects = await apiClient.getProjects();

    return projects.filter((p) => p.status === 'ACTIVE_HEALTHY');
  }

  /**
   * Set up a Supabase connection for a specific project.
   * Creates a dedicated PostgreSQL role, retrieves the pooler connection string,
   * and stores the credentials in the connector account.
   */
  async setupSupabaseProject(
    workbookId: WorkbookId,
    connectorAccountId: string,
    projectRef: string,
    actor: Actor,
  ): Promise<void> {
    const account = await this.findOne(workbookId, connectorAccountId, actor);
    if ((account.service as Service) !== Service.SUPABASE) {
      throw new BadRequestException('This endpoint is only available for Supabase connections');
    }

    const accessToken = await this.oauthService.getValidAccessToken(connectorAccountId);
    const apiClient = new SupabaseApiClient(accessToken);

    // 1. Generate credentials for the service account
    const dbUsername = `scratch_service_account_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const dbPassword = randomUUID() + randomUUID().replace(/-/g, '');

    // 2. Create the PostgreSQL role via Management API
    const createUserSQL = buildCreateUserSQL(dbUsername, dbPassword);
    await apiClient.executeQuery(projectRef, createUserSQL);

    // 3. Get pooler connection config
    const poolerConfigs = await apiClient.getPoolerConfig(projectRef);
    if (!poolerConfigs || poolerConfigs.length === 0) {
      throw new InternalServerErrorException('Could not retrieve Supabase pooler configuration');
    }

    // 4. Build connection string from pooler config
    const connectionString = buildConnectionString(
      poolerConfigs[0].connection_string,
      dbUsername,
      dbPassword,
      projectRef,
    );

    // 5. Test the connection
    const pgClient = new KnexPGClient(connectionString, { sslNoVerify: true });
    try {
      await pgClient.testQuery();
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to connect to Supabase with the created credentials: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await pgClient.dispose();
    }

    // 6. Update encrypted credentials with all Supabase-specific fields
    const decryptedCredentials = await this.credentialEncryptionService.decryptCredentials(
      account.encryptedCredentials as unknown as EncryptedData,
    );
    decryptedCredentials.supabaseProjectRef = projectRef;
    decryptedCredentials.supabaseDbUsername = dbUsername;
    decryptedCredentials.supabaseDbPassword = dbPassword;
    decryptedCredentials.connectionString = connectionString;

    const encryptedCredentials = await this.credentialEncryptionService.encryptCredentials(decryptedCredentials);

    await this.db.client.connectorAccount.update({
      where: { id: connectorAccountId },
      data: {
        encryptedCredentials: encryptedCredentials as Record<string, any>,
        healthStatus: 'OK',
        healthStatusLastCheckedAt: new Date(),
        healthStatusMessage: null,
      },
    });

    await this.auditLogService.logEvent({
      actor,
      eventType: 'update',
      message: `Configured Supabase project for connection ${account.displayName}`,
      entityId: connectorAccountId as ConnectorAccountId,
      context: { service: Service.SUPABASE, projectRef },
    });
  }

  // ---------------------------------------------------------------------------
  // Test connection
  // ---------------------------------------------------------------------------

  async testConnection(workbookId: WorkbookId, id: string, actor: Actor): Promise<TestConnectionResponse> {
    const account = await this.findOne(workbookId, id, actor);
    try {
      const connector = await this.connectorsService.getConnector({
        service: account.service as Service,
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
