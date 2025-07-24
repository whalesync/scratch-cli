export interface ChatSessionSummary {
  id: string;
  name: string;
  last_activity: string; // ISO datetime string
  created_at: string; // ISO datetime string
}

export interface SessionListResponse {
  sessions: ChatSessionSummary[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  message: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  name: string;
  chat_history: ChatMessage[];
  summary_history: Array<{
    requestSummary: string;
    responseSummary: string;
  }>;
  created_at: string;
  last_activity: string;
  snapshot_id?: string;
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

export type SendMessageResponse = {
  type: 'message_success';
  response_message: string;
  response_summary: string;
  request_summary: string;
}

export type DeleteSessionResponse = {
  success: boolean;
};

export type AgentErrorResponse = {
  type: 'agent_error';
  detail: string;
};
