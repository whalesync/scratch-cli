/**
 * NOTE: Keep in sync with spinner/server/src/oauth/oauth-initiate-options.dto.ts:OAuthInitiateOptionsDto.
 */
export type OAuthInitiateOptionsDto = {
  redirectPrefix: string;
  connectionMethod?: 'OAUTH_SYSTEM' | 'OAUTH_CUSTOM';
  customClientId?: string;
  customClientSecret?: string;
  connectionName?: string;
};

/**
 * NOTE: Keep in sync with spinner/server/src/oauth/types.ts:OAuthStatePayload.
 */
export type OAuthStatePayload = {
  redirectPrefix: string;
  userId: string;
  organizationId: string;
  service: string;
  connectionMethod: 'OAUTH_SYSTEM' | 'OAUTH_CUSTOM';
  customClientId?: string;
  customClientSecret?: string;
  connectionName?: string;
  ts: number;
};
