/**
 * Provides base configuration values for all the API calls from MCP to the Scratchpad server.
 */
class ApiConfig {
  private apiUrl: string;
  private apiToken: string | null;

  constructor() {
    this.apiUrl = process.env.SCRATCHPAD_SERVER_URL ?? "http://localhost:3010";
    this.apiToken = process.env.SCRATCHPAD_API_TOKEN ?? "";
  }

  public getApiUrl() {
    return this.apiUrl;
  }

  public setApiToken(token: string) {
    this.apiToken = token;
  }

  public getApiToken() {
    return this.apiToken;
  }

  getApiHeaders(): HeadersInit {
    return {
      Authorization: `API-Token ${this.apiToken}`,
    };
  }

  getApiServerHealthUrl() {
    return `${this.apiUrl}/health`;
  }
}

export const API_CONFIG = new ApiConfig();
