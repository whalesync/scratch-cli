import { oauthApi } from '@/lib/api/oauth';
import { OAuthService } from '@/types/oauth';

/**
 * Initiate OAuth flow for a service
 * This function will redirect the user to the OAuth provider
 */
export const initiateOAuth = async (
  service: OAuthService,
  options?: { connectionMethod?: 'OAUTH_SYSTEM' | 'OAUTH_CUSTOM'; customClientId?: string; customClientSecret?: string },
): Promise<void> => {
  try {
    // Store the service in localStorage so the callback page can identify it 
    localStorage.setItem('oauth_service', service);
    
    // Get the OAuth URL from the server
    const response = await oauthApi.initiate(service, options);
    
    // Redirect the user to the OAuth provider
    window.location.href = response.authUrl;
  } catch (error) {
    console.error(`Failed to initiate OAuth for ${service}:`, error);
    throw error;
  }
};

/**
 * Clean up OAuth service from localStorage
 * Call this after successful OAuth completion
 */
export const cleanupOAuthService = (): void => {
  try {
    localStorage.removeItem('oauth_service');
  } catch (error) {
    console.warn('Failed to cleanup OAuth service from localStorage:', error);
  }
};
