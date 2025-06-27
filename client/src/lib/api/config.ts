/**
 * Provides base configuration values for all the API calls.
 */
class ApiConfig {
  private apiUrl: string;
  private authToken: string | null;

  constructor() {
    this.apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3010";
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

  getAuthHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.authToken}`,
    };
  }

  getApiServerHealthUrl() {
    return `${this.apiUrl}/health`;
  }
}

export const API_CONFIG = new ApiConfig();
