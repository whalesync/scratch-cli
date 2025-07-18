export interface ChatSessionSummary {
  id: string;
  name: string;
  last_activity: string; // ISO datetime string
  created_at: string; // ISO datetime string
}

export interface SessionListResponse {
  sessions: ChatSessionSummary[];
}

export interface Capability {
  code: string;
  enabledByDefault: boolean;
  description: string;
}

export interface CreateSessionResponse {
  session: ChatSessionSummary;
  available_capabilities: Capability[];
} 