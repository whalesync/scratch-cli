import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthType, Service } from '@prisma/client';
import { DbService } from '../db/db.service';
import { DecryptedCredentials } from '../remote-service/connector-account/types/encrypted-credentials.interface';
import { createConnectorAccountId } from '../types/ids';
import { EncryptedData, getEncryptionService } from '../utils/encryption';
import { OAuthProvider, OAuthTokenResponse } from './oauth-provider.interface';
import { NotionOAuthProvider } from './providers/notion-oauth.provider';
import { YouTubeOAuthProvider } from './providers/youtube-oauth.provider';

export interface OAuthInitiateResponse {
  authUrl: string;
  state: string;
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
    private readonly youtubeProvider: YouTubeOAuthProvider,
  ) {
    // Register OAuth providers
    this.providers.set('NOTION', this.notionProvider);
    this.providers.set('YOUTUBE', this.youtubeProvider);
    // Future providers can be added here:
    // this.providers.set('airtable', this.airtableProvider);
  }

  private async encryptCredentials(credentials: DecryptedCredentials): Promise<EncryptedData> {
    const encryptionService = getEncryptionService();
    return await encryptionService.encryptObject(credentials);
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

  /**
   * Initiate OAuth flow for any supported service
   */
  initiateOAuth(service: string, userId: string): OAuthInitiateResponse {
    const provider = this.providers.get(service);
    if (!provider) {
      throw new BadRequestException(`Unsupported OAuth service: ${service}`);
    }

    const state = this.generateState(userId);
    const authUrl = provider.generateAuthUrl(userId, state);

    return {
      authUrl,
      state,
    };
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleOAuthCallback(
    service: string,
    userId: string,
    callbackData: OAuthCallbackRequest,
  ): Promise<{ connectorAccountId: string }> {
    const provider = this.providers.get(service);
    if (!provider) {
      throw new BadRequestException(`Unsupported OAuth service: ${service}`);
    }

    // Validate state parameter
    if (!this.validateState(callbackData.state, userId)) {
      throw new BadRequestException('Invalid state parameter');
    }

    // Exchange authorization code for access token
    const tokenResponse = await provider.exchangeCodeForTokens(callbackData.code);

    // Create new connector account
    const connectorAccount = await this.createOAuthAccount(service, userId, tokenResponse);

    return { connectorAccountId: connectorAccount.id };
  }

  /**
   * Refresh OAuth tokens for a connector account
   */
  async refreshOAuthTokens(connectorAccountId: string): Promise<void> {
    const account = await this.db.client.connectorAccount.findUnique({
      where: { id: connectorAccountId },
    });

    if (!account || account.authType !== AuthType.OAUTH) {
      throw new BadRequestException('Invalid OAuth connector account for token refresh');
    }

    const decryptedCredentials = await this.decryptCredentials(
      account.encryptedCredentials as unknown as EncryptedData,
    );

    if (!decryptedCredentials.oauthRefreshToken) {
      throw new BadRequestException('No refresh token available');
    }

    const provider = this.providers.get(account.service.toLowerCase());
    if (!provider) {
      throw new BadRequestException(`No OAuth provider found for service: ${account.service}`);
    }

    const tokenResponse = await provider.refreshTokens(decryptedCredentials.oauthRefreshToken);

    // Update the credentials
    decryptedCredentials.oauthAccessToken = tokenResponse.access_token;
    decryptedCredentials.oauthRefreshToken = tokenResponse.refresh_token || decryptedCredentials.oauthRefreshToken;
    decryptedCredentials.oauthExpiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;

    const encryptedCredentials = await this.encryptCredentials(decryptedCredentials);

    await this.db.client.connectorAccount.update({
      where: { id: connectorAccountId },
      data: {
        encryptedCredentials: encryptedCredentials as Record<string, any>,
      },
    });
  }

  /**
   * Create new OAuth connector account with OAuth data
   */
  private async createOAuthAccount(service: string, userId: string, tokenResponse: OAuthTokenResponse) {
    const serviceEnum = this.mapServiceStringToEnum(service);

    // Prepare credentials for encryption
    const credentials: DecryptedCredentials = {
      oauthAccessToken: tokenResponse.access_token,
      oauthRefreshToken: tokenResponse.refresh_token,
      oauthExpiresAt: tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000) : undefined,
      oauthWorkspaceId: tokenResponse.workspace_id,
    };

    const encryptedCredentials = await this.encryptCredentials(credentials);

    // Create new account
    return this.db.client.connectorAccount.create({
      data: {
        id: createConnectorAccountId(),
        userId,
        service: serviceEnum,
        displayName: `${service.charAt(0).toUpperCase() + service.slice(1)} (OAuth)`,
        authType: AuthType.OAUTH,
        encryptedCredentials: encryptedCredentials as Record<string, any>,
      },
    });
  }

  /**
   * Map service string to Service enum
   */
  private mapServiceStringToEnum(service: string): Service {
    switch (service.toLowerCase()) {
      case 'notion':
        return Service.NOTION;
      case 'airtable':
        return Service.AIRTABLE;
      case 'youtube':
        return Service.YOUTUBE; // For now, map Google to CUSTOM
      default:
        throw new BadRequestException(`Unsupported service: ${service}`);
    }
  }

  /**
   * Generate a secure state parameter
   */
  private generateState(userId: string): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    return Buffer.from(`${userId}:${timestamp}:${random}`).toString('base64');
  }

  /**
   * Validate state parameter
   */
  private validateState(state: string, userId: string): boolean {
    try {
      const decoded = Buffer.from(state, 'base64').toString();
      const [stateUserId] = decoded.split(':');
      return stateUserId === userId;
    } catch {
      return false;
    }
  }

  /**
   * Check if OAuth tokens are expired and need refresh
   */
  async isTokenExpired(connectorAccountId: string): Promise<boolean> {
    const account = await this.db.client.connectorAccount.findUnique({
      where: { id: connectorAccountId },
      select: { encryptedCredentials: true },
    });

    if (!account?.encryptedCredentials) {
      return false; // No credentials, assume valid
    }

    const decryptedCredentials = await this.decryptCredentials(
      account.encryptedCredentials as unknown as EncryptedData,
    );

    if (!decryptedCredentials.oauthExpiresAt) {
      return false; // No expiration set, assume valid
    }

    // Add 5 minute buffer to refresh before actual expiration
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    return new Date() >= new Date(decryptedCredentials.oauthExpiresAt.getTime() - bufferTime);
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidAccessToken(connectorAccountId: string): Promise<string> {
    const account = await this.db.client.connectorAccount.findUnique({
      where: { id: connectorAccountId },
    });

    if (!account || account.authType !== AuthType.OAUTH) {
      throw new BadRequestException('Invalid OAuth account');
    }

    const decryptedCredentials = await this.decryptCredentials(
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

      const updatedCredentials = await this.decryptCredentials(
        updatedAccount.encryptedCredentials as unknown as EncryptedData,
      );

      if (!updatedCredentials.oauthAccessToken) {
        throw new UnauthorizedException('Failed to refresh access token');
      }

      return updatedCredentials.oauthAccessToken;
    }

    return decryptedCredentials.oauthAccessToken;
  }
}
