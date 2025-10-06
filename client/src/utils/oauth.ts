import { oauthApi } from '@/lib/api/oauth';
import { OAuthService } from '@/types/oauth';
import { OAuthInitiateOptions } from '@/types/server-entities/oauth';

/**
 * Initiate OAuth flow for a service
 * This function will redirect the user to the OAuth provider
 */
export const initiateOAuth = async (
  service: OAuthService,
  options?: OAuthInitiateOptions,
): Promise<void> => {
  try {
    // Get the OAuth URL from the server (service is now included in state parameter)
    const response = await oauthApi.initiate(service, options);
    
    // Redirect the user to the OAuth provider
    window.location.href = response.authUrl;
  } catch (error) {
    console.error(`Failed to initiate OAuth for ${service}:`, error);
    throw error;
  }
};

