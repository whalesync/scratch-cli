import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OAuthProvider, OAuthTokenResponse } from '../oauth-provider.interface';

/**
 * Shopify OAuth 2.0 Provider
 *
 * Documentation:
 * - OAuth Flow: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant
 *
 * Key Points:
 * - Shopify offline access tokens do not expire — no refresh flow needed
 * - The authorize URL requires the merchant's shop domain: https://{shop}.myshopify.com/admin/oauth/authorize
 * - Token exchange endpoint: https://{shop}.myshopify.com/admin/oauth/access_token
 * - The shop domain is threaded through the OAuth state so it's available at callback time
 */
@Injectable()
export class ShopifyOAuthProvider implements OAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly scopes =
    'read_products,write_products,read_orders,read_customers,read_inventory,read_content,write_content,read_files,read_metaobjects';

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('SHOPIFY_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('SHOPIFY_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('REDIRECT_URI') || '';
  }

  generateAuthUrl(userId: string, state: string, overrides?: { clientId?: string; shopDomain?: string }): string {
    const clientId = overrides?.clientId || this.clientId;
    const shopDomain = overrides?.shopDomain;

    if (!shopDomain) {
      throw new Error('Shop domain is required for Shopify OAuth');
    }

    const normalizedDomain = this.normalizeShopDomain(shopDomain);

    const params = new URLSearchParams({
      client_id: clientId,
      scope: this.scopes,
      redirect_uri: this.redirectUri,
      state: state,
    });

    return `https://${normalizedDomain}/admin/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    overrides?: { clientId?: string; clientSecret?: string; shopDomain?: string },
  ): Promise<OAuthTokenResponse> {
    const clientId = overrides?.clientId || this.clientId;
    const clientSecret = overrides?.clientSecret || this.clientSecret;
    const shopDomain = overrides?.shopDomain;

    if (!shopDomain) {
      throw new Error('Shop domain is required for Shopify token exchange');
    }

    const normalizedDomain = this.normalizeShopDomain(shopDomain);

    const response = await axios.post<{ access_token: string; scope: string }>(
      `https://${normalizedDomain}/admin/oauth/access_token`,
      {
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    // Shopify offline tokens don't expire, so no refresh_token or expires_in.
    // Store the shop domain as workspace_id so it persists in credentials.
    return {
      access_token: response.data.access_token,
      refresh_token: undefined,
      expires_in: undefined,
      workspace_id: normalizedDomain,
    };
  }

  refreshTokens(): Promise<OAuthTokenResponse> {
    // Shopify offline access tokens don't expire — no refresh flow needed
    throw new Error('Shopify offline access tokens do not expire. Refresh is not supported.');
  }

  getServiceName(): string {
    return 'shopify';
  }

  getRedirectUri(): string {
    return this.redirectUri;
  }

  /**
   * Normalize the shop domain to the canonical `{shop}.myshopify.com` form.
   * Accepts inputs like:
   *   - "my-store"
   *   - "my-store.myshopify.com"
   *   - "https://my-store.myshopify.com"
   *   - "https://my-store.myshopify.com/"
   */
  private normalizeShopDomain(input: string): string {
    let domain = input.trim().toLowerCase();

    // Strip protocol
    domain = domain.replace(/^https?:\/\//, '');
    // Strip trailing slash
    domain = domain.replace(/\/+$/, '');
    // Strip any path
    domain = domain.split('/')[0];

    // If it doesn't already end with .myshopify.com, append it
    if (!domain.endsWith('.myshopify.com')) {
      domain = `${domain}.myshopify.com`;
    }

    return domain;
  }
}
