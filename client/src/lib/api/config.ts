import axios, { AxiosInstance } from 'axios';

/**
 * Singleton providing base configuration values for all the API calls.
 */
class ApiConfig {
  private apiUrl: string;
  private authToken: string | null;
  private snapshotWebsocketToken: string | null;
  // Axios instance calls to the API server
  private apiAxiosInstance: AxiosInstance | null = null;

  constructor() {
    this.apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3010';
    this.authToken = null;
    this.snapshotWebsocketToken = null;
  }

  public getApiUrl() {
    return this.apiUrl;
  }

  public setAuthToken(token: string) {
    this.authToken = token;
    // Reset axios instance to pick up new token
    this.apiAxiosInstance = null;
  }

  public getAuthToken() {
    return this.authToken;
  }

  getAuthHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.authToken}`,
    };
  }

  /**
   * Get or create an axios instance configured with base URL and auth headers
   */
  public getAxiosInstance(): AxiosInstance {
    if (!this.apiAxiosInstance) {
      this.apiAxiosInstance = axios.create({
        baseURL: this.apiUrl,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Add request interceptor to include auth token
      this.apiAxiosInstance.interceptors.request.use((config) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        return config;
      });
    }
    return this.apiAxiosInstance;
  }

  getApiServerHealthUrl() {
    return `${this.apiUrl}/health`;
  }

  public setSnapshotWebsocketToken(token: string) {
    this.snapshotWebsocketToken = token;
  }

  public getSnapshotWebsocketToken() {
    return this.snapshotWebsocketToken;
  }
}

export const API_CONFIG = new ApiConfig();
