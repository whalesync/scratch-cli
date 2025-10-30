import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OAuthProvider, OAuthTokenResponse } from '../oauth-provider.interface';

/**
 * Wix OAuth 2.0 Provider
 *
 * Documentation:
 * - OAuth Flow: https://dev.wix.com/docs/rest/app-management/oauth-2/introduction
 * - Authorization: https://dev.wix.com/docs/build-apps/develop-your-app/access/authentication/about-oauth
 *
 * Key Points:
 * - Access tokens expire in 5 minutes (300 seconds)
 * - Refresh tokens are provided and should be used to get new access tokens
 * - Authorization URL: https://www.wix.com/installer/install
 * - Token endpoints: https://www.wix.com/oauth/access
 */
@Injectable()
export class WixOAuthProvider implements OAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly tokenUrl = 'https://www.wix.com/oauth/access';
  private readonly expiresIn = 300; // 5 minutes
  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('WIX_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('WIX_CLIENT_SECRET') || '';
    // TODO: Move this to a per environment variable. e.g. WIX_REDIRECT_URI_PROD, WIX_REDIRECT_URI_DEV, etc.
    this.redirectUri = this.configService.get<string>('REDIRECT_URI') || 'http://localhost:3000/oauth/callback';
  }

  generateAuthUrl(userId: string, state: string): string {
    /**
     * Wix uses a custom OAuth flow where you redirect to their installer/consent page
     * The authorization URL should be: https://www.wix.com/installer/install
     *
     * The consent URL is:
     * https://www.wix.com/app-oauth-installation/consent
     *
     * Query parameters:
     * - appId: Your Wix App ID (same as client_id in most cases)
     * - redirectUrl: Where to redirect after authorization
     * - state: State parameter for CSRF protection
     * - token: Optional token for additional security
     */
    const params = new URLSearchParams({
      appId: this.clientId,
      redirectUrl: this.redirectUri,
      state: state,
    });

    return `https://www.wix.com/installer/install?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokenResponse> {
    /**
     * Exchange authorization code for access token
     * POST https://www.wix.com/oauth/access
     *
     * Request body:
     * {
     *   "grant_type": "authorization_code",
     *   "client_id": "YOUR_APP_ID",
     *   "client_secret": "YOUR_SECRET_KEY",
     *   "code": "AUTHORIZATION_CODE"
     * }
     */
    const response = await axios.post<{ access_token: string; refresh_token: string }>(
      this.tokenUrl,
      {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    // Wix doesn't include expires_in in the response because token lifetimes are predefined:
    // - Access tokens: 5 minutes (300 seconds)
    // - Refresh tokens: valid as long as the app is installed
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: this.expiresIn,
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokenResponse> {
    /**
     * Refresh access token using refresh token
     * POST https://www.wix.com/oauth/access
     *
     * Request body:
     * {
     *   "grant_type": "refresh_token",
     *   "client_id": "YOUR_APP_ID",
     *   "client_secret": "YOUR_SECRET_KEY",
     *   "refresh_token": "YOUR_REFRESH_TOKEN"
     * }
     *
     * Note: Refresh tokens remain valid as long as the app is installed on the user's site
     */
    const response = await axios.post<{ access_token: string; refresh_token: string }>(
      this.tokenUrl,
      {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    // Same as exchangeCodeForTokens, expires_in is not included in the response
    // Access tokens always expire in 5 minutes
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: this.expiresIn,
    };
  }

  getServiceName(): string {
    return 'wix';
  }

  getRedirectUri(): string {
    return this.redirectUri;
  }
}
