export type AgentService = 'openrouter';

export interface CreateAgentCredentialDto {
  service: AgentService;
  apiKey: string;
  name?: string;
  tokenUsageWarningLimit?: number;
  default?: boolean;
}

export interface UpdateAgentCredentialDto {
  name?: string;
  tokenUsageWarningLimit?: number;
  default?: boolean;
}
