/**
 * NOTE: Keep in sync with spinner/server/src/oauth/oauth-initiate-options.dto.ts:OAuthStatePayload.
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
