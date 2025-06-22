/**
 * Provides base configuration values for all the API calls.
 */
class ApiConfig {
  private apiUrl: string;
  private authToken: string | null;

  constructor() {
    this.apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    this.authToken = null;
  }

  public getApiUrl() {
    return this.apiUrl;
  }

  public setAuthToken(token: string) {
    this.authToken = token;
  }

  public getAuthToken() {
    return this.authToken;
  }

  getDefaultHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.authToken}`,
    };
  }
}

export const API_CONFIG = new ApiConfig();
