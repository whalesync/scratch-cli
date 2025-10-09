/**
 * Singleton providing base configuration values for all the API calls.
 */
class ApiConfig {
  private apiUrl: string;
  private aiAgentApiUrl: string;
  private aiAgentWebSocketUrl: string;
  private authToken: string | null;
  private agentJwt: string | null;
  private snapshotWebsocketToken: string | null;

  constructor() {
    this.apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3010";
    this.aiAgentApiUrl = process.env.NEXT_PUBLIC_AI_AGENT_API_URL || "http://localhost:8000";
    this.aiAgentWebSocketUrl = process.env.NEXT_PUBLIC_AI_AGENT_WEBSOCKET_URL || "ws://localhost:8000";
    this.authToken = null;
    this.agentJwt = null;
    this.snapshotWebsocketToken = null;
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

  public getAiAgentApiUrl() {
    return this.aiAgentApiUrl;
  }

  public setAgentJwt(jwt: string) {
    this.agentJwt = jwt;
  }

  public getAgentJwt() {
    return this.agentJwt;
  }

  getAiAgentAuthHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.agentJwt}`,
    };
  }

  public getAiAgentWebSocketUrl() {
    return this.aiAgentWebSocketUrl;
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
