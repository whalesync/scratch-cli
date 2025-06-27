export interface ChatSessionSummary {
  id: string;
  name: string;
  last_activity: string; // ISO datetime string
  created_at: string; // ISO datetime string
}

export interface SessionListResponse {
  sessions: ChatSessionSummary[];
} 