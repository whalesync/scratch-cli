/**
 * NOTE: Keep in sync with spinner/server/src/oauth/oauth-initiate-options.dto.ts:OAuthInitiateOptionsDto.
 */
export type OAuthInitiateOptionsDto = {
  connectionMethod?: 'OAUTH_SYSTEM' | 'OAUTH_CUSTOM';
  customClientId?: string;
  customClientSecret?: string;
  connectionName?: string;
};
