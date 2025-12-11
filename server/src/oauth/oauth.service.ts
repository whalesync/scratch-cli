import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthType, ConnectorAccount } from '@prisma/client';
import { createConnectorAccountId, Service, ValidatedOAuthInitiateOptionsDto } from '@spinner/shared-types';
import { capitalize } from 'lodash';
import { CredentialEncryptionService } from 'src/credential-encryption/credential-encryption.service';
import { PostHogEventName, PostHogService } from 'src/posthog/posthog.service';
import { getServiceDisplayName } from 'src/remote-service/connectors/display-names';
import { OnboardingService } from 'src/users/onboarding.service';
import { canCreateDataSource } from 'src/users/subscription-utils';
import { Actor } from 'src/users/types';
import { DbService } from '../db/db.service';
import { DecryptedCredentials } from '../remote-service/connector-account/types/encrypted-credentials.interface';
import { EncryptedData } from '../utils/encryption';
import { OAuthProvider, OAuthTokenResponse } from './oauth-provider.interface';
import { NotionOAuthProvider } from './providers/notion-oauth.provider';
import { WebflowOAuthProvider } from './providers/webflow-oauth.provider';
import { WixOAuthProvider } from './providers/wix-oauth.provider';
import { YouTubeOAuthProvider } from './providers/youtube-oauth.provider';
import { OAuthStatePayload } from './types';

/**
 * Response from the request to get the OAuth authorization redirect URL for a connector.
 */
export interface OAuthInitiateResponse {
  authUrl: string;
}

export interface OAuthCallbackRequest {
  code: string;
  state: string;
}

@Injectable()
export class OAuthService {
  private readonly providers: Map<string, OAuthProvider> = new Map();

  constructor(
    private readonly db: DbService,
    private readonly notionProvider: NotionOAuthProvider,
    private readonly webflowProvider: WebflowOAuthProvider,
    private readonly wixProvider: WixOAuthProvider,
    private readonly youTubeProvider: YouTubeOAuthProvider,
    private readonly posthogService: PostHogService,
    private readonly credentialEncryptionService: CredentialEncryptionService,
    private readonly onboardingService: OnboardingService,
  ) {
    // Register OAuth providers
    this.providers.set('NOTION', this.notionProvider);
    this.providers.set('WEBFLOW', this.webflowProvider);
    this.providers.set('WIX_BLOG', this.wixProvider);
    this.providers.set('YOUTUBE', this.youTubeProvider);
    // Future providers can be added here:
    // this.providers.set('airtable', this.airtableProvider);
  }

  /**
   * Initiates an OAuth authorization flow for a supported external service.
   * Builds a state payload containing user info, connection preferences, and security data,
   * then generates the authorization URL that the client should redirect the user to.
   * Supports both system-managed OAuth apps and custom OAuth client credentials.
   */
  initiateOAuth(service: string, actor: Actor, options: ValidatedOAuthInitiateOptionsDto): OAuthInitiateResponse {
    const provider = this.providers.get(service);
    if (!provider) {
      throw new BadRequestException(`Unsupported OAuth service: ${service}`);
    }

    // Embed connection method and optional custom client info into state (base64 JSON)
    const statePayload: OAuthStatePayload = {
      redirectPrefix: options.redirectPrefix,
      userId: actor.userId,
      organizationId: actor.organizationId,
      service,
      connectionMethod: options.connectionMethod ?? 'OAUTH_SYSTEM',
      customClientId: options.customClientId,
      customClientSecret: options.customClientSecret,
      connectionName: options.connectionName,
      returnPage: options.returnPage,
      connectorAccountId: options.connectorAccountId,
      ts: Date.now(),
    };
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64');

    const authUrl = provider.generateAuthUrl(actor.userId, state, {
      clientId: options.connectionMethod === 'OAUTH_CUSTOM' ? options.customClientId : undefined,
    });

    return { authUrl };
  }

  /**
   * Handles the OAuth callback after the user authorizes the application.
   * Decodes and validates the state parameter to ensure the request matches the original user,
   * exchanges the authorization code for access/refresh tokens via the provider,
   * and creates a new ConnectorAccount record with the encrypted credentials.
   */
  async handleOAuthCallback(
    service: string,
    actor: Actor,
    callbackData: OAuthCallbackRequest,
  ): Promise<{ connectorAccountId: string }> {
    const provider = this.providers.get(service);
    if (!provider) {
      throw new BadRequestException(`Unsupported OAuth service: ${service}`);
    }

    // Decode state and validate
    let statePayload: OAuthStatePayload;
    try {
      const decoded = Buffer.from(callbackData.state, 'base64').toString();
      const parsed = JSON.parse(decoded) as OAuthStatePayload;
      statePayload = parsed;
    } catch {
      throw new BadRequestException('Invalid state parameter');
    }

    if (statePayload.userId !== actor.userId) {
      throw new BadRequestException('Invalid state parameter: invalid user Id ${statePayload.userId}');
    }

    if (statePayload.organizationId !== actor.organizationId) {
      throw new BadRequestException('Invalid state parameter: invalid organization Id ${statePayload.organizationId}');
    }

    let existingConnectorAccount: ConnectorAccount | null = null;
    if (statePayload.connectorAccountId) {
      existingConnectorAccount = await this.db.client.connectorAccount.findUnique({
        where: { id: statePayload.connectorAccountId },
      });
      if (!existingConnectorAccount) {
        throw new BadRequestException(
          'Invalid state parameter: invalid connector account Id ${statePayload.connectorAccountId}',
        );
      }
    }

    // Exchange authorization code for access token (with overrides for custom OAuth)
    const tokenResponse = await provider.exchangeCodeForTokens(callbackData.code, {
      clientId: statePayload.connectionMethod === 'OAUTH_CUSTOM' ? statePayload.customClientId : undefined,
      clientSecret: statePayload.connectionMethod === 'OAUTH_CUSTOM' ? statePayload.customClientSecret : undefined,
    });

    if (existingConnectorAccount) {
      await this.updateOAuthAccount(existingConnectorAccount, actor, tokenResponse, {
        connectionMethod: statePayload.connectionMethod,
        customClientId: statePayload.customClientId,
        customClientSecret: statePayload.customClientSecret,
        connectionName: statePayload.connectionName,
      });
      return { connectorAccountId: existingConnectorAccount.id };
    } else {
      // Create new connector account (include connection method and custom client creds for storage)
      const connectorAccount = await this.createOAuthAccount(service, actor, tokenResponse, {
        connectionMethod: statePayload.connectionMethod,
        customClientId: statePayload.customClientId,
        customClientSecret: statePayload.customClientSecret,
        connectionName: statePayload.connectionName,
      });

      // Mark onboarding step as completed
      await this.onboardingService.markStepCompleted(actor.userId, 'gettingStartedV1', 'dataSourceConnected');

      return { connectorAccountId: connectorAccount.id };
    }
  }

  /**
   * Refreshes expired OAuth tokens for a connector account using the stored refresh token.
   * Fetches the account, decrypts credentials, calls the provider's refresh endpoint,
   * and updates the database with the new access token (and optionally new refresh token).
   * Throws if the account is not OAuth-based or lacks a refresh token.
   */
  async refreshOAuthTokens(connectorAccountId: string): Promise<void> {
    const account = await this.db.client.connectorAccount.findUnique({
      where: { id: connectorAccountId },
    });

    if (!account || account.authType !== AuthType.OAUTH) {
      throw new BadRequestException('Invalid OAuth connector account for token refresh');
    }

    const decryptedCredentials = await this.credentialEncryptionService.decryptCredentials(
      account.encryptedCredentials as unknown as EncryptedData,
    );

    if (!decryptedCredentials.oauthRefreshToken) {
      throw new BadRequestException('No refresh token available');
    }

    const provider = this.providers.get(account.service);
    if (!provider) {
      throw new BadRequestException(`No OAuth provider found for service: ${account.service}`);
    }

    const tokenResponse = await provider.refreshTokens(decryptedCredentials.oauthRefreshToken);

    // Update the credentials
    decryptedCredentials.oauthAccessToken = tokenResponse.access_token;
    decryptedCredentials.oauthRefreshToken = tokenResponse.refresh_token || decryptedCredentials.oauthRefreshToken;
    decryptedCredentials.oauthExpiresAt = this.expiresInToOAuthExpiresAt(tokenResponse.expires_in);

    const encryptedCredentials = await this.credentialEncryptionService.encryptCredentials(decryptedCredentials);
    await this.db.client.connectorAccount.update({
      where: { id: connectorAccountId },
      data: { encryptedCredentials },
    });
  }

  /**
   * Create new OAuth connector account with OAuth data.
   */
  private async createOAuthAccount(
    service: string,
    actor: Actor,
    tokenResponse: OAuthTokenResponse,
    connectionInfo?: {
      connectionMethod: 'OAUTH_SYSTEM' | 'OAUTH_CUSTOM';
      customClientId?: string;
      customClientSecret?: string;
      connectionName?: string;
    },
  ) {
    const serviceEnum = this.mapServiceStringToEnum(service);

    // Prepare credentials for encryption
    const credentials: DecryptedCredentials = {
      oauthAccessToken: tokenResponse.access_token,
      oauthRefreshToken: tokenResponse.refresh_token,
      oauthExpiresAt: this.expiresInToOAuthExpiresAt(tokenResponse.expires_in),
      oauthWorkspaceId: tokenResponse.workspace_id,
      customOAuthClientId:
        connectionInfo?.connectionMethod === 'OAUTH_CUSTOM' ? connectionInfo.customClientId : undefined,
      customOAuthClientSecret:
        connectionInfo?.connectionMethod === 'OAUTH_CUSTOM' ? connectionInfo.customClientSecret : undefined,
    };

    const encryptedCredentials = await this.credentialEncryptionService.encryptCredentials(credentials);

    const numExistingDataSources = await this.db.client.connectorAccount.count({
      where: { organizationId: actor.organizationId, service: serviceEnum },
    });

    if (!canCreateDataSource(actor.subscriptionStatus, numExistingDataSources)) {
      throw new ForbiddenException(
        `You have reached the maximum number of ${getServiceDisplayName(serviceEnum)} data sources for your subscription`,
      );
    }

    // Create new account
    const newConnectorAccount = await this.db.client.connectorAccount.create({
      data: {
        id: createConnectorAccountId(),
        userId: actor.userId,
        organizationId: actor.organizationId,
        service: serviceEnum,
        displayName:
          connectionInfo?.connectionName ??
          `${capitalize(service)} (${connectionInfo?.connectionMethod === 'OAUTH_CUSTOM' ? 'Private OAuth' : 'OAuth'})`,
        authType: AuthType.OAUTH,
        encryptedCredentials: encryptedCredentials as Record<string, any>,
        healthStatus: 'OK', // assume healthy because this connection is created via a successful oauth flow
        healthStatusLastCheckedAt: new Date(),
      },
    });

    this.posthogService.captureEvent(PostHogEventName.CONNECTOR_ACCOUNT_CREATED, actor.userId, {
      service: serviceEnum,
      authType: AuthType.OAUTH,
      healthStatus: 'OK',
    });

    return newConnectorAccount;
  }

  private async updateOAuthAccount(
    connectorAccount: ConnectorAccount,
    actor: Actor,
    tokenResponse: OAuthTokenResponse,
    connectionInfo?: {
      connectionMethod: 'OAUTH_SYSTEM' | 'OAUTH_CUSTOM';
      customClientId?: string;
      customClientSecret?: string;
      connectionName?: string;
    },
  ): Promise<void> {
    // Prepare credentials for encryption
    const credentials: DecryptedCredentials = {
      oauthAccessToken: tokenResponse.access_token,
      oauthRefreshToken: tokenResponse.refresh_token,
      oauthExpiresAt: this.expiresInToOAuthExpiresAt(tokenResponse.expires_in),
      oauthWorkspaceId: tokenResponse.workspace_id,
      customOAuthClientId:
        connectionInfo?.connectionMethod === 'OAUTH_CUSTOM' ? connectionInfo.customClientId : undefined,
      customOAuthClientSecret:
        connectionInfo?.connectionMethod === 'OAUTH_CUSTOM' ? connectionInfo.customClientSecret : undefined,
    };

    const encryptedCredentials = await this.credentialEncryptionService.encryptCredentials(credentials);

    // Create new account
    await this.db.client.connectorAccount.update({
      where: { id: connectorAccount.id },
      data: {
        encryptedCredentials: encryptedCredentials as Record<string, any>,
        healthStatus: 'OK', // assume healthy because this connection is created via a successful oauth flow
        healthStatusLastCheckedAt: new Date(),
      },
    });

    this.posthogService.captureEvent(PostHogEventName.CONNECTOR_ACCOUNT_REAUTHORIZED, actor.userId, {
      service: connectorAccount.service,
      authType: AuthType.OAUTH,
      healthStatus: 'OK',
    });
  }

  /**
   * Map service string to Service enum.
   */
  private mapServiceStringToEnum(service: string): Service {
    switch (service.toLowerCase()) {
      case 'webflow':
        return Service.WEBFLOW;
      case 'notion':
        return Service.NOTION;
      case 'airtable':
        return Service.AIRTABLE;
      case 'youtube':
        return Service.YOUTUBE; // For now, map Google to CUSTOM
      case 'wix_blog':
        return Service.WIX_BLOG;
      default:
        throw new BadRequestException(`Unsupported service: ${service}`);
    }
  }

  /**
   * Checks whether the OAuth access token for a connector account has expired or will expire soon.
   * Uses a 5-minute buffer to proactively refresh tokens before they actually expire,
   * preventing failed API calls due to race conditions. Returns false if no expiration is set.
   */
  async isTokenExpired(connectorAccountId: string): Promise<boolean> {
    const account = await this.db.client.connectorAccount.findUnique({
      where: { id: connectorAccountId },
      select: { encryptedCredentials: true },
    });

    if (!account?.encryptedCredentials) {
      return false; // No credentials, assume valid
    }

    const decryptedCredentials = await this.credentialEncryptionService.decryptCredentials(
      account.encryptedCredentials as unknown as EncryptedData,
    );

    if (!decryptedCredentials.oauthExpiresAt) {
      return false; // No expiration set, assume valid
    }

    // Add 5 minute buffer to refresh before actual expiration
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    return new Date() >= new Date(new Date(decryptedCredentials.oauthExpiresAt).getTime() - bufferTime);
  }

  /**
   * Retrieves a valid OAuth access token for making API calls to external services.
   * Automatically checks token expiration and refreshes if needed before returning.
   * This is the primary method other services should use to obtain tokens for API requests.
   */
  async getValidAccessToken(connectorAccountId: string): Promise<string> {
    const account = await this.db.client.connectorAccount.findUnique({
      where: { id: connectorAccountId },
    });

    if (!account || account.authType !== AuthType.OAUTH) {
      throw new BadRequestException('Invalid OAuth account');
    }

    const decryptedCredentials = await this.credentialEncryptionService.decryptCredentials(
      account.encryptedCredentials as unknown as EncryptedData,
    );

    if (!decryptedCredentials.oauthAccessToken) {
      throw new UnauthorizedException('No access token available');
    }

    // Check if token needs refresh
    if (await this.isTokenExpired(connectorAccountId)) {
      await this.refreshOAuthTokens(connectorAccountId);

      // Fetch updated account with new token
      const updatedAccount = await this.db.client.connectorAccount.findUnique({
        where: { id: connectorAccountId },
      });

      if (!updatedAccount) {
        throw new UnauthorizedException('Failed to refresh access token');
      }

      const updatedCredentials = await this.credentialEncryptionService.decryptCredentials(
        updatedAccount.encryptedCredentials as unknown as EncryptedData,
      );

      if (!updatedCredentials.oauthAccessToken) {
        throw new UnauthorizedException('Failed to refresh access token');
      }

      return updatedCredentials.oauthAccessToken;
    }

    return decryptedCredentials.oauthAccessToken;
  }

  /**
   * Returns the YouTube OAuth client configuration (client ID, secret, and redirect URI).
   * Used by the YouTube connector service to initialize the Google API client for making
   * authenticated requests. Exposes the provider's configuration without token data.
   */
  getYouTubeOAuthCredentials(): { clientId: string; clientSecret: string; redirectUri: string } {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const youtubeProvider = this.providers.get('YOUTUBE') as any;
    if (!youtubeProvider) {
      throw new Error('YouTube OAuth provider not found');
    }

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      clientId: youtubeProvider.clientId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      clientSecret: youtubeProvider.clientSecret,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      redirectUri: youtubeProvider.redirectUri,
    };
  }

  private expiresInToOAuthExpiresAt(tokenExpiresIn?: number): string | undefined {
    return tokenExpiresIn ? new Date(Date.now() + tokenExpiresIn * 1000).toISOString() : undefined;
  }
}
