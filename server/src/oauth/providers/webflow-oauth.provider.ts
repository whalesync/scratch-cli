import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebflowClient } from 'webflow-api';
import { OauthScope } from 'webflow-api/api/types/OAuthScope';
import { OAuthProvider, OAuthTokenResponse } from '../oauth-provider.interface';

@Injectable()
export class WebflowOAuthProvider implements OAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('WEBFLOW_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('WEBFLOW_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('REDIRECT_URI') || '';
  }

  generateAuthUrl(userId: string, state: string): string {
    // Use the SDK's helper method to generate the authorization URL
    // Scopes needed for CMS access
    const scopes: OauthScope[] = [
      'authorized_user:read',
      'cms:read',
      'cms:write',
      'pages:read',
      'pages:write',
      'sites:read',
      'sites:write',
    ];

    return WebflowClient.authorizeURL({
      state,
      scope: scopes,
      clientId: this.clientId,
      redirectUri: this.redirectUri,
    });
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokenResponse> {
    try {
      // Use the SDK's helper method to exchange the code for tokens
      // getAccessToken returns a string (the access token directly)
      const accessToken = await WebflowClient.getAccessToken({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        code,
        redirectUri: this.redirectUri,
      });

      // Webflow doesn't provide refresh tokens in the standard OAuth flow
      // The access token is long-lived
      return {
        access_token: accessToken,
        refresh_token: undefined,
        expires_in: undefined,
      };
    } catch (error) {
      throw new Error(`Failed to exchange code for tokens: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  refreshTokens(): Promise<OAuthTokenResponse> {
    // Webflow doesn't support token refresh in the standard way
    // Access tokens are long-lived and don't expire
    throw new Error('Webflow does not support token refresh. Access tokens are long-lived.');
  }

  getServiceName(): string {
    return 'webflow';
  }

  getRedirectUri(): string {
    return this.redirectUri;
  }
}
