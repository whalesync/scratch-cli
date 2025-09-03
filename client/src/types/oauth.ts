export interface OAuthInitiateResponse {
  authUrl: string;
  state: string;
}

export interface OAuthCallbackRequest {
  code: string;
  state: string;
}

export interface OAuthCallbackResponse {
  connectorAccountId: string;
}

export type OAuthService = 'notion' | 'airtable' | 'google';

export interface OAuthError {
  error: string;
  error_description?: string;
}
