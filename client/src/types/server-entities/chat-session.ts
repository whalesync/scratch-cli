import { RecordCell } from "@/types/common";

export interface ChatSessionSummary {
  id: string;
  name: string;
  last_activity: string; // ISO datetime string
  created_at: string; // ISO datetime string
}

export interface SessionListResponse {
  sessions: ChatSessionSummary[];
}

export type DataScope = 'table' | 'record' | 'column';

// The DTO for sending a message to the agent
export interface SendMessageRequestDTO {
  message: string;
  api_token?: string;
  style_guides?: { name: string; content: string }[];
  capabilities?: string[];
  model?: string;
  view_id?: string;
  read_focus?: RecordCell[];
  write_focus?: RecordCell[];
  active_table_id?: string;
  data_scope?: DataScope;
  record_id?: string;
  column_id?: string;
}

export interface ChatMessage {
  id:string;
  role: 'user' | 'assistant';
  message: string;
  timestamp: string;
  payload?: object;
  variant: 'admin' | 'message' | 'progress' | 'error';
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


export type CancelAgentRunResponse = {
  message: string;
};