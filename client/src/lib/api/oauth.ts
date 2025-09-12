import { API_CONFIG } from './config';

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

export const oauthApi = {
  /**
   * Initiate OAuth flow for a service
   */
  initiate: async (
    service: string,
    options?: { connectionMethod?: 'OAUTH_SYSTEM' | 'OAUTH_CUSTOM'; customClientId?: string; customClientSecret?: string },
  ): Promise<OAuthInitiateResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/oauth/${service}/initiate`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connectionMethod: options?.connectionMethod,
        customClientId: options?.customClientId,
        customClientSecret: options?.customClientSecret,
      }),
    });

    if (!res.ok) {
      throw new Error(res.statusText ?? `Failed to initiate OAuth for ${service}`);
    }

    return res.json();
  },

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  callback: async (service: string, callbackData: OAuthCallbackRequest): Promise<OAuthCallbackResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/oauth/${service}/callback`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callbackData),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || res.statusText || `Failed to handle OAuth callback for ${service}`);
    }

    return res.json();
  },

  /**
   * Refresh OAuth tokens for a connector account
   */
  refresh: async (connectorAccountId: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/oauth/refresh`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ connectorAccountId }),
    });

    if (!res.ok) {
      throw new Error(res.statusText ?? 'Failed to refresh OAuth tokens');
    }

    return res.json();
  },
};
