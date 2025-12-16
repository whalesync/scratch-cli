export type ClientMessageType = 'message' | 'ping' | 'echo_error';
export type ServerMessageType =
  | 'connection_confirmed'
  | 'pong'
  | 'agent_error'
  | 'message_progress'
  | 'message_response';

export interface WebSocketMessage {
  type: ClientMessageType | ServerMessageType;
  data?: object;
  timestamp?: string;
}

export interface BasicAgentMessageDataPayload {
  message: string;
}

export interface AgentErrorResponseDataPayload {
  detail: string;
}

export interface UsageStats {
  requests: number;
  request_tokens: number;
  response_tokens: number;
  total_tokens: number;
}

export interface AgentResponseDataPayload {
  response_message: string;
  response_summary: string;
  request_summary: string;
  usage_stats: UsageStats;
}

export interface AgentProgressMessageData {
  progress_type:
    | 'run_started'
    | 'status'
    | 'tool_call'
    | 'tool_result'
    | 'create_agent'
    | 'request_sent'
    | 'model_response'
    | 'build_response'
    | 'task_started';
  message: string;
  payload: Record<string, unknown>;
}
