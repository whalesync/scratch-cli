export interface EncryptedCredentials {
  apiKey?: string;
  // WordPress specific
  username?: string;
  password?: string;
  endpoint?: string;

  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  oauthExpiresAt?: string; // ISO string
  oauthWorkspaceId?: string;
  // Optional custom OAuth app credentials (encrypted at rest)
  customOAuthClientId?: string;
  customOAuthClientSecret?: string;
}

export interface DecryptedCredentials {
  apiKey?: string;
  // WordPress specific
  username?: string;
  password?: string;
  endpoint?: string;

  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  oauthExpiresAt?: Date;
  oauthWorkspaceId?: string;
  // Optional custom OAuth app credentials (plaintext in memory only)
  customOAuthClientId?: string;
  customOAuthClientSecret?: string;
}
